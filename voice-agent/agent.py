import asyncio
import logging
import os
import json
from dotenv import load_dotenv
from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli
from livekit.agents.voice import Agent, AgentSession
from livekit.plugins import deepgram, openai, silero
from livekit.agents.llm import ChatContext, ChatMessage
from livekit import rtc
from edge_tts_plugin import EdgeTTS  # Our free TTS

# Load environment variables from .env file
load_dotenv()

# Load Groq API key from parent backend/.env if not in local .env
if not os.getenv('GROQ_API_KEY'):
    parent_env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(parent_env_path):
        from dotenv import load_dotenv as load_parent_env
        load_parent_env(parent_env_path)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def entrypoint(ctx: JobContext):
    """Main entry point for the voice agent"""
    logger.info(f"Starting voice agent for room: {ctx.room.name}")
    
    # Connect to the room
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    
    # Check if Groq API key is available
    groq_api_key = os.getenv('GROQ_API_KEY')
    if not groq_api_key:
        logger.error("GROQ_API_KEY not found in environment variables")
        return
    
    logger.info("Using Groq LLM with llama-3.1-8b-instant model")
    
    # Store room reference
    room = ctx.room
    
    # Create the voice agent
    agent = Agent(
        instructions=(
            "You are a friendly onboarding assistant for Veltro, a business management platform. "
            "Your job is to help users set up their business by collecting information through natural conversation.\n\n"
            
            "CRITICAL RULES:\n"
            "- NEVER read out loud any text in parentheses - those are just notes for you\n"
            "- NEVER say 'Fill_field', 'Send', or mention data channel actions\n"
            "- NEVER say technical terms like 'step_complete', 'action', etc.\n"
            "- Keep responses brief, natural, and conversational\n"
            "- Don't repeat examples out loud - they're just for your reference\n"
            "- Speak ONLY what a human assistant would say\n\n"
            
            "WORKFLOW:\n"
            "1. Ask questions for each step naturally\n"
            "2. Collect the user's answers\n"
            "3. After collecting data for a step, repeat back what you collected\n"
            "4. Ask 'Does this look correct, or would you like to change anything?'\n"
            "5. If they want changes, ask what to change and update the data\n"
            "6. Once confirmed, move to next step\n\n"
            
            "STEP 1 - Business Profile:\n"
            "Ask these questions naturally, one at a time:\n"
            "1. What's your business name?\n"
            "2. What industry or category is your business in?\n"
            "3. Can you briefly describe what your business does?\n"
            "4. What's your business phone number? If they don't have one or want to skip, that's fine.\n"
            "5. What's your business email? Optional.\n"
            "6. Do you have a website? Optional.\n\n"
            "After collecting, say: 'Great! Let me confirm what I have:\n"
            "- Business name: [name]\n"
            "- Industry: [industry]\n"
            "- Description: [description]\n"
            "- Phone: [phone or say 'none provided']\n"
            "- Email: [email or say 'none provided']\n"
            "- Website: [website or say 'none provided']\n"
            "Does this look correct, or would you like to change anything?'\n\n"
            
            "STEP 2 - Services:\n"
            "Ask: 'What services do you offer? For each service, tell me the name, how long it takes in minutes, and the price in dollars.'\n"
            "Example for your reference only (don't read this): Haircut, 30 minutes, $50\n\n"
            "After collecting, say: 'Let me confirm your services:\n"
            "[List each service with name, duration, price]\n"
            "Does this look correct, or would you like to add, remove, or change any services?'\n\n"
            
            "STEP 3 - Operating Hours:\n"
            "Ask: 'What are your business hours? Tell me which days you're open and what time you open and close.'\n"
            "Example for your reference only (don't read this): Monday to Friday 9am to 5pm\n\n"
            "After collecting, say: 'Let me confirm your business hours:\n"
            "[List each day with hours]\n"
            "Does this look correct, or would you like to change anything?'\n\n"
            
            "After ALL steps are confirmed, say: 'Perfect! Your business is all set up. You can now launch your dashboard!'\n"
        ),
        vad=silero.VAD.load(),
        stt=deepgram.STT(),
        llm=openai.LLM(
            model="llama-3.1-8b-instant",  # Smaller, faster model with higher limits
            api_key=groq_api_key,
            base_url="https://api.groq.com/openai/v1"
        ),
        tts=deepgram.TTS(model="aura-asteria-en"),
    )
    
    # Create the agent session
    session = AgentSession()
    
    # Store the last AI message to avoid duplicates
    last_ai_message = {"text": ""}
    
    # Hook into session events to capture transcripts
    @session.on("user_input_transcribed")
    def on_user_input_transcribed(event):
        """Capture user's speech transcription"""
        if event.is_final and event.transcript.strip():
            text = event.transcript
            logger.info(f"[USER] {text}")
            
            async def publish_user_message():
                try:
                    await room.local_participant.publish_data(
                        json.dumps({"action": "user_message", "text": text}).encode('utf-8'),
                        reliable=True,
                        topic="chat"
                    )
                    logger.info("[PUBLISHED] User message")
                except Exception as e:
                    logger.error(f"[ERROR] Failed to publish user message: {e}")
            
            asyncio.create_task(publish_user_message())
    
    @session.on("speech_created")
    def on_speech_created(event):
        """Capture agent speech BEFORE TTS starts playing"""
        logger.info(f"[SPEECH CREATED] Agent is about to speak")
        # The speech_handle doesn't have the text yet, we'll get it from conversation_item_added
    
    @session.on("conversation_item_added")
    def on_conversation_item_added(event):
        """Capture conversation items - send AI message IMMEDIATELY"""
        item = event.item
        
        # Only capture agent messages (user messages are handled by user_input_transcribed)
        if item.role == "assistant" and item.text_content:
            text = item.text_content
            
            # Avoid duplicate messages
            if text == last_ai_message["text"]:
                logger.info(f"[SKIPPED] Duplicate AI message")
                return
            
            last_ai_message["text"] = text
            logger.info(f"[AI] {text}")
            
            # Parse for action triggers in the response
            async def process_and_publish():
                try:
                    # Log the full message for debugging
                    logger.info(f"[DEBUG] Processing message for data extraction...")
                    
                    # Extract structured data from agent's confirmation messages
                    # This happens silently - not part of spoken text
                    import re
                    
                    # Only extract if this is a confirmation message (contains "let me confirm")
                    is_confirmation = 'let me confirm' in text.lower()
                    
                    if is_confirmation:
                        logger.info("[DEBUG] This is a confirmation message, extracting data...")
                        
                        # Extract business name (handle bullet points and various formats)
                        name_match = re.search(r'[-•]?\s*business name:?\s*([^\n]+?)(?:\n|$)', text, re.IGNORECASE)
                        if name_match:
                            name = name_match.group(1).strip()
                            # Clean up - remove trailing punctuation and extra text
                            name = re.sub(r'[,\.]?\s*(does this|is this|correct).*$', '', name, flags=re.IGNORECASE).strip()
                            if name and len(name) < 100:  # Sanity check
                                logger.info(f"[DATA] Extracted name: {name}")
                                await room.local_participant.publish_data(
                                    json.dumps({"action": "fill_field", "field": "name", "value": name}).encode('utf-8'),
                                    reliable=True,
                                    topic="chat"
                                )
                        
                        # Extract industry/category (handle bullet points)
                        industry_match = re.search(r'[-•]?\s*industry:?\s*([^\n]+?)(?:\n|$)', text, re.IGNORECASE)
                        if industry_match:
                            industry = industry_match.group(1).strip()
                            # Clean up
                            industry = re.sub(r'[,\.]?\s*(does this|is this|correct).*$', '', industry, flags=re.IGNORECASE).strip()
                            if industry and len(industry) < 100:
                                logger.info(f"[DATA] Extracted industry: {industry}")
                                await room.local_participant.publish_data(
                                    json.dumps({"action": "fill_field", "field": "customCategory", "value": industry}).encode('utf-8'),
                                    reliable=True,
                                    topic="chat"
                                )
                        
                        # Extract description (handle bullet points)
                        desc_match = re.search(r'[-•]?\s*description:?\s*([^\n]+?)(?:\n|$)', text, re.IGNORECASE)
                        if desc_match:
                            description = desc_match.group(1).strip()
                            # Clean up
                            description = re.sub(r'[,\.]?\s*(does this|is this|correct).*$', '', description, flags=re.IGNORECASE).strip()
                            if description and len(description) < 200:
                                logger.info(f"[DATA] Extracted description: {description}")
                                await room.local_participant.publish_data(
                                    json.dumps({"action": "fill_field", "field": "description", "value": description}).encode('utf-8'),
                                    reliable=True,
                                    topic="chat"
                                )
                        
                        # Extract phone (handle bullet points)
                        phone_match = re.search(r'[-•]?\s*phone:?\s*([^\n]+?)(?:\n|$)', text, re.IGNORECASE)
                        if phone_match:
                            phone = phone_match.group(1).strip()
                            # Clean up and check if it's actually a phone number
                            phone = re.sub(r'[,\.]?\s*(does this|is this|correct).*$', '', phone, flags=re.IGNORECASE).strip()
                            if phone and 'none' not in phone.lower() and 'not provided' not in phone.lower() and len(phone) < 50:
                                logger.info(f"[DATA] Extracted phone: {phone}")
                                await room.local_participant.publish_data(
                                    json.dumps({"action": "fill_field", "field": "phone", "value": phone}).encode('utf-8'),
                                    reliable=True,
                                    topic="chat"
                                )
                        
                        # Extract email (handle bullet points)
                        email_match = re.search(r'[-•]?\s*email:?\s*([^\n]+?)(?:\n|$)', text, re.IGNORECASE)
                        if email_match:
                            email = email_match.group(1).strip()
                            # Clean up and check if it's actually an email
                            email = re.sub(r'[,\.]?\s*(does this|is this|correct).*$', '', email, flags=re.IGNORECASE).strip()
                            if email and 'none' not in email.lower() and 'not provided' not in email.lower() and '@' in email and len(email) < 100:
                                logger.info(f"[DATA] Extracted email: {email}")
                                await room.local_participant.publish_data(
                                    json.dumps({"action": "fill_field", "field": "email", "value": email}).encode('utf-8'),
                                    reliable=True,
                                    topic="chat"
                                )
                        
                        # Extract website (handle bullet points)
                        website_match = re.search(r'[-•]?\s*website:?\s*([^\n]+?)(?:\n|$)', text, re.IGNORECASE)
                        if website_match:
                            website = website_match.group(1).strip()
                            # Clean up and check if it's actually a URL
                            website = re.sub(r'[,\.]?\s*(does this|is this|correct).*$', '', website, flags=re.IGNORECASE).strip()
                            if website and 'none' not in website.lower() and 'not provided' not in website.lower() and len(website) < 100:
                                logger.info(f"[DATA] Extracted website: {website}")
                                await room.local_participant.publish_data(
                                    json.dumps({"action": "fill_field", "field": "website", "value": website}).encode('utf-8'),
                                    reliable=True,
                                    topic="chat"
                                )
                    
                    # Extract services (look for service listings in confirmation)
                    # Pattern: "Service Name: 30 minutes, $50" or "Service Name, 30 minutes, $50" or "- Service Name - 30 min - $50"
                    if 'let me confirm' in text.lower() and 'service' in text.lower():
                        logger.info("[DEBUG] Extracting services from confirmation...")
                        services = []
                        
                        # Pattern 1: "Service Name: 30 minutes, $50"
                        service_pattern1 = re.findall(r'([A-Z][^:\n]+?):\s*(\d+)\s*(?:minutes?|min)[,\s]+\$(\d+)', text, re.IGNORECASE)
                        for service_match in service_pattern1:
                            service_name = service_match[0].strip()
                            # Clean up service name - remove leading bullets or dashes
                            service_name = re.sub(r'^[-•\s]+', '', service_name).strip()
                            duration = int(service_match[1])
                            price = int(service_match[2])
                            
                            # Sanity check
                            if service_name and len(service_name) < 100 and duration > 0 and price >= 0:
                                services.append({
                                    "name": service_name,
                                    "duration": duration,
                                    "price": price
                                })
                                logger.info(f"[DEBUG] Found service: {service_name}, {duration}min, ${price}")
                        
                        # Pattern 2: "- Service Name, 30 minutes, $50" or "• Service Name - 30 min - $50"
                        if not services:
                            service_pattern2 = re.findall(r'[-•]\s*([^,\n]+)[,\-]\s*(\d+)\s*(?:minutes?|min)[,\-]\s*\$(\d+)', text, re.IGNORECASE)
                            for service_match in service_pattern2:
                                service_name = service_match[0].strip()
                                duration = int(service_match[1])
                                price = int(service_match[2])
                                
                                if service_name and len(service_name) < 100 and duration > 0 and price >= 0:
                                    services.append({
                                        "name": service_name,
                                        "duration": duration,
                                        "price": price
                                    })
                                    logger.info(f"[DEBUG] Found service: {service_name}, {duration}min, ${price}")
                        
                        if services:
                            logger.info(f"[DATA] Extracted services: {services}")
                            await room.local_participant.publish_data(
                                json.dumps({"action": "fill_field", "field": "services", "value": services}).encode('utf-8'),
                                reliable=True,
                                topic="chat"
                            )
                        else:
                            logger.warning("[DEBUG] No services extracted from confirmation message")
                    
                    # Extract working hours (look for hours listings in confirmation)
                    # Pattern: "Monday: 9am - 5pm" or "Monday to Friday 9am to 5pm"
                    if 'let me confirm' in text.lower() and ('business hours' in text.lower() or 'hours:' in text.lower()):
                        logger.info("[DEBUG] Extracting working hours from confirmation...")
                        working_hours = []
                        
                        # Pattern 1: Individual days "Monday: 9am - 5pm"
                        day_lines = re.findall(r'(monday|tuesday|wednesday|thursday|friday|saturday|sunday):?\s*(\d+(?::\d+)?(?:am|pm)?)\s*(?:-|to)\s*(\d+(?::\d+)?(?:am|pm)?)', text, re.IGNORECASE)
                        for day_match in day_lines:
                            day = day_match[0].lower()
                            start_time = day_match[1].lower()
                            end_time = day_match[2].lower()
                            working_hours.append({
                                "day": day,
                                "isOpen": True,
                                "start": start_time,
                                "end": end_time
                            })
                            logger.info(f"[DEBUG] Found hours: {day} {start_time}-{end_time}")
                        
                        # Pattern 2: Range "Monday to Friday 9am to 5pm"
                        if not working_hours:
                            range_match = re.search(r'(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+to\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(\d+(?::\d+)?(?:am|pm)?)\s+(?:to|-)\s+(\d+(?::\d+)?(?:am|pm)?)', text, re.IGNORECASE)
                            if range_match:
                                days_order = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
                                start_day = range_match.group(1).lower()
                                end_day = range_match.group(2).lower()
                                start_time = range_match.group(3).lower()
                                end_time = range_match.group(4).lower()
                                
                                start_idx = days_order.index(start_day)
                                end_idx = days_order.index(end_day)
                                
                                for i in range(start_idx, end_idx + 1):
                                    working_hours.append({
                                        "day": days_order[i],
                                        "isOpen": True,
                                        "start": start_time,
                                        "end": end_time
                                    })
                                    logger.info(f"[DEBUG] Found hours: {days_order[i]} {start_time}-{end_time}")
                        
                        if working_hours:
                            logger.info(f"[DATA] Extracted working hours: {working_hours}")
                            await room.local_participant.publish_data(
                                json.dumps({"action": "fill_field", "field": "workingHours", "value": working_hours}).encode('utf-8'),
                                reliable=True,
                                topic="chat"
                            )
                        else:
                            logger.warning("[DEBUG] No working hours extracted from confirmation message")
                    
                    # Check for action triggers in the text
                    if "show_gmail_connect" in text.lower() or "connect gmail button" in text.lower():
                        logger.info("[ACTION] Triggering Gmail connect button")
                        await room.local_participant.publish_data(
                            json.dumps({"action": "show_gmail_connect"}).encode('utf-8'),
                            reliable=True,
                            topic="chat"
                        )
                    
                    if "show_calendar_connect" in text.lower() or "connect calendar button" in text.lower():
                        logger.info("[ACTION] Triggering Calendar connect button")
                        await room.local_participant.publish_data(
                            json.dumps({"action": "show_calendar_connect"}).encode('utf-8'),
                            reliable=True,
                            topic="chat"
                        )
                    
                    # Check for step completion - look for various patterns
                    if "step_complete" in text.lower() or "step complete" in text.lower():
                        # Extract step number
                        match = re.search(r'step[_\s]*complete[_\s]*(\d+)', text.lower())
                        if match:
                            step_num = int(match.group(1))
                            logger.info(f"[ACTION] Step {step_num} complete")
                            await room.local_participant.publish_data(
                                json.dumps({"action": "step_complete", "step": step_num}).encode('utf-8'),
                                reliable=True,
                                topic="chat"
                            )
                    
                    # Also check if agent is moving to next major section (indicates step completion)
                    # Step 1 complete: mentions services or asks about services
                    if any(phrase in text.lower() for phrase in [
                        "what services do you offer",
                        "let's talk about your services",
                        "let's talk about the services",
                        "tell me about your services",
                        "next, let's talk about the services",
                        "what services does",
                        "services you offer",
                        "services does"
                    ]):
                        logger.info("[ACTION] Detected step 1 completion (moving to services)")
                        await room.local_participant.publish_data(
                            json.dumps({"action": "step_complete", "step": 1}).encode('utf-8'),
                            reliable=True,
                            topic="chat"
                        )
                    
                    # Step 2 complete: mentions business hours
                    if any(phrase in text.lower() for phrase in [
                        "what are your business hours",
                        "let's set up your business hours",
                        "operating hours",
                        "when are you open",
                        "what are your business hours like",
                        "how late do you stay open"
                    ]):
                        logger.info("[ACTION] Detected step 2 completion (moving to hours)")
                        await room.local_participant.publish_data(
                            json.dumps({"action": "step_complete", "step": 2}).encode('utf-8'),
                            reliable=True,
                            topic="chat"
                        )
                    
                    # Step 3 complete: says "all set" or "workspace is being set up"
                    if any(phrase in text.lower() for phrase in ["your business is all set up", "you can now launch", "workspace is being set up"]):
                        logger.info("[ACTION] Detected step 3 completion (all done)")
                        await room.local_participant.publish_data(
                            json.dumps({"action": "step_complete", "step": 3}).encode('utf-8'),
                            reliable=True,
                            topic="chat"
                        )
                        # Also send complete action
                        await room.local_participant.publish_data(
                            json.dumps({"action": "voice_complete"}).encode('utf-8'),
                            reliable=True,
                            topic="chat"
                        )
                    
                    # Send the AI message to frontend
                    await room.local_participant.publish_data(
                        json.dumps({"action": "ai_message", "text": text}).encode('utf-8'),
                        reliable=True,
                        topic="chat"
                    )
                    logger.info("[PUBLISHED] AI message sent")
                except Exception as e:
                    logger.error(f"[ERROR] Failed to publish AI message: {e}")
            
            # Create task immediately
            asyncio.create_task(process_and_publish())
    
    # Start the session
    await session.start(agent, room=ctx.room)
    
    # Don't send automatic greeting - let frontend handle initial message based on progress
    logger.info("[AGENT] Ready and listening...")
    
    # Keep the agent running
    await asyncio.sleep(float('inf'))

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
