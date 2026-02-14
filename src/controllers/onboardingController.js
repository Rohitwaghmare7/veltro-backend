const Business = require('../models/Business');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const jwt = require('jsonwebtoken');

// Generate JWT token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '7d',
    });
};

// Generate refresh token
const generateRefreshToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
        expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d',
    });
};

// @desc    Update onboarding step data
// @route   PUT /api/onboarding/step/:stepNum
// @access  Private (owner)
exports.updateStep = async (req, res, next) => {
    try {
        const { stepNum } = req.params;
        const step = parseInt(stepNum);

        if (step < 1 || step > 5) {
            return res.status(400).json({
                success: false,
                message: 'Step number must be between 1 and 5',
            });
        }

        const business = await Business.findOne({ owner: req.user._id });
        if (!business) {
            return res.status(404).json({
                success: false,
                message: 'Business not found',
            });
        }

        // Update fields based on step
        switch (step) {
            case 1: {
                // Business profile
                const { name, address, category, phone, email, website, description } = req.body;
                if (name) business.name = name;
                if (address) business.address = address;
                if (category) business.category = category;
                if (phone) business.phone = phone;
                if (email) business.email = email;
                if (website) business.website = website;
                if (description) business.description = description;
                break;
            }
            case 2: {
                // Connect email (placeholder — real integration Phase 3)
                const { emailConnected } = req.body;
                business.emailConnected = emailConnected || false;
                break;
            }
            case 3: {
                // Contact form fields
                const { contactFormFields } = req.body;
                if (contactFormFields) business.contactFormFields = contactFormFields;
                break;
            }
            case 4: {
                // Working hours / availability / services
                const { workingHours, services } = req.body;
                if (workingHours) business.workingHours = workingHours;
                if (services) business.services = services;
                break;
            }
            case 5: {
                // Intake form (placeholder for Phase 4)
                // Just mark as completed
                break;
            }
        }

        // Update onboarding step progress
        if (step >= business.onboardingStep) {
            business.onboardingStep = Math.min(step + 1, 5);
        }

        await business.save();

        res.status(200).json({
            success: true,
            data: {
                business,
                currentStep: business.onboardingStep,
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get onboarding progress
// @route   GET /api/onboarding/progress
// @access  Private
exports.getProgress = async (req, res, next) => {
    try {
        // If user is staff, skip business onboarding
        if (req.user.role === 'staff') {
            return res.status(200).json({
                success: true,
                data: {
                    currentStep: 5,
                    isSetupComplete: true,
                    business: null
                }
            });
        }

        const business = await Business.findOne({ owner: req.user._id });
        if (!business) {
            return res.status(404).json({
                success: false,
                message: 'Business not found',
            });
        }

        res.status(200).json({
            success: true,
            data: {
                currentStep: business.onboardingStep,
                isSetupComplete: business.isSetupComplete,
                business: {
                    name: business.name,
                    address: business.address,
                    category: business.category,
                    phone: business.phone,
                    email: business.email,
                    workingHours: business.workingHours,
                    contactFormFields: business.contactFormFields,
                    emailConnected: business.emailConnected,
                    services: business.services,
                    bookingSlug: business.bookingSlug,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Complete onboarding
// @route   POST /api/onboarding/complete
// @access  Private (owner)
exports.completeOnboarding = async (req, res, next) => {
    try {
        const business = await Business.findOne({ owner: req.user._id });
        if (!business) {
            return res.status(404).json({
                success: false,
                message: 'Business not found',
            });
        }

        business.isSetupComplete = true;
        business.onboardingStep = 5;
        await business.save();

        // Mark user as onboarded
        const user = await User.findByIdAndUpdate(
            req.user._id, 
            { isOnboarded: true },
            { new: true } // Return updated user
        );

        // Generate new tokens with updated user data
        const token = generateToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        // Send Welcome Email
        if (business.emailConnected) {
            try {
                await sendEmail({
                    email: user.email,
                    subject: 'Welcome to Thierobbs! 🚀',
                    message: `Hi ${user.name},\n\nCongratulations on setting up your business workspace for ${business.name}!\n\nYou can now start managing your bookings, leads, and inventory from your dashboard.\n\nBest,\nThe Thierobbs Team`,
                });
            } catch (err) {
                console.error('Failed to send welcome email', err);
                // Don't fail the request if email fails, just log it
            }
        }

        res.status(200).json({
            success: true,
            data: {
                message: 'Onboarding completed successfully!',
                business,
                token,
                refreshToken,
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    isOnboarded: user.isOnboarded,
                    businessId: user.businessId
                }
            },
        });
    } catch (error) {
        next(error);
    }
};
