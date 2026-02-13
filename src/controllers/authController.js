const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Business = require('../models/Business');

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

// @desc    Register user (owner) + create business OR Register as staff
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
    try {
        const { name, email, password, businessName, inviteToken } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'An account with this email already exists',
            });
        }

        let userRole = 'owner';
        let businessId = null;

        // If registering via invite
        if (inviteToken) {
            const Staff = require('../models/Staff');
            const staff = await Staff.findOne({
                inviteToken,
                inviteStatus: 'pending'
            });

            if (staff) {
                userRole = 'staff';
                businessId = staff.businessId;
            }
        }

        // Create user
        const user = await User.create({
            name,
            email,
            password,
            role: userRole,
            businessId, // Set if staff, otherwise updated below for owner
            isOnboarded: !!inviteToken, // Mark as onboarded if staff (skips onboarding flow)
        });

        let business;

        if (userRole === 'owner') {
            // Create business for owner
            business = await Business.create({
                name: businessName || `${name}'s Business`,
                owner: user._id,
            });

            // Link business to user
            user.businessId = business._id;
            await user.save();
        } else if (inviteToken) {
            // Finalize staff record
            const Staff = require('../models/Staff');
            const staff = await Staff.findOne({ inviteToken });
            if (staff) {
                staff.userId = user._id;
                staff.inviteStatus = 'accepted';
                // staff.inviteToken = undefined; // REMOVED: Wipe in acceptInvite instead
                await staff.save();

                business = await Business.findById(staff.businessId);
            }
        }

        // Generate tokens
        const token = generateToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        // Send welcome email (only for new owners, not staff)
        if (userRole === 'owner') {
            try {
                const { sendEmail } = require('../services/email.service');
                
                const welcomeEmailHtml = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1>Welcome to Veltro! 🎉</h1>
                            </div>
                            <div class="content">
                                <p>Hi ${name},</p>
                                <p>Thank you for joining Veltro! We're excited to have you on board.</p>
                                <p>Veltro is your all-in-one platform for managing your business operations:</p>
                                <ul>
                                    <li>📧 Inbox - Manage customer communications</li>
                                    <li>📅 Bookings - Schedule and track appointments</li>
                                    <li>📝 Forms - Collect customer information</li>
                                    <li>👥 Leads - Track and convert prospects</li>
                                    <li>🤖 Automations - Save time with automated workflows</li>
                                    <li>📊 Analytics - Monitor your business performance</li>
                                </ul>
                                <p>To get started, complete your business profile and set up your first services.</p>
                                <p style="text-align: center;">
                                    <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/onboarding" class="button">Complete Setup</a>
                                </p>
                                <p>If you have any questions or need help, feel free to reach out to our support team.</p>
                                <p>Best regards,<br>The Veltro Team</p>
                            </div>
                            <div class="footer">
                                <p>This email was sent to ${email}</p>
                                <p>© ${new Date().getFullYear()} Veltro. All rights reserved.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `;

                await sendEmail({
                    to: email,
                    subject: 'Welcome to Veltro - Let\'s Get Started! 🚀',
                    html: welcomeEmailHtml,
                });

                console.log('✅ Welcome email sent to:', email);
            } catch (emailError) {
                // Don't fail registration if email fails
                console.error('❌ Failed to send welcome email:', emailError.message);
            }
        }

        res.status(201).json({
            success: true,
            data: {
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    businessId: user.businessId,
                    isOnboarded: user.isOnboarded,
                },
                business: business ? {
                    _id: business._id,
                    name: business.name,
                    onboardingStep: business.onboardingStep,
                    isSetupComplete: business.isSetupComplete,
                    bookingSlug: business.bookingSlug,
                } : null,
                token,
                refreshToken,
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password',
            });
        }

        // Find user with password field included
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }

        // Check password
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }

        // Get business info
        const business = await Business.findOne({ owner: user._id });

        const token = generateToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        res.status(200).json({
            success: true,
            data: {
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    businessId: user.businessId,
                    isOnboarded: user.isOnboarded,
                },
                business: business
                    ? {
                        _id: business._id,
                        name: business.name,
                        onboardingStep: business.onboardingStep,
                        isSetupComplete: business.isSetupComplete,
                        bookingSlug: business.bookingSlug,
                    }
                    : null,
                token,
                refreshToken,
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);
        const business = await Business.findById(user.businessId);

        res.status(200).json({
            success: true,
            data: {
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    businessId: user.businessId,
                    isOnboarded: user.isOnboarded,
                    avatar: user.avatar,
                },
                business: business
                    ? {
                        _id: business._id,
                        name: business.name,
                        category: business.category,
                        onboardingStep: business.onboardingStep,
                        isSetupComplete: business.isSetupComplete,
                        bookingSlug: business.bookingSlug,
                    }
                    : null,
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Refresh token
// @route   POST /api/auth/refresh
// @access  Public
exports.refreshToken = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: 'Refresh token is required',
            });
        }

        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid refresh token',
            });
        }

        const newToken = generateToken(user._id);
        const newRefreshToken = generateRefreshToken(user._id);

        res.status(200).json({
            success: true,
            data: {
                token: newToken,
                refreshToken: newRefreshToken,
            },
        });
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired refresh token',
        });
    }
};

// @desc    Forgot password - send reset email
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Please provide an email address',
            });
        }

        const user = await User.findOne({ email });

        if (!user) {
            // Don't reveal if user exists or not for security
            return res.status(200).json({
                success: true,
                message: 'If an account with that email exists, a password reset link has been sent.',
            });
        }

        // Generate reset token
        const resetToken = user.getResetPasswordToken();
        await user.save({ validateBeforeSave: false });

        // Create reset URL
        const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;

        try {
            const { sendEmail, passwordResetEmail } = require('../services/email.service');
            const emailTemplate = passwordResetEmail(user.name, resetUrl);

            await sendEmail({
                to: user.email,
                subject: emailTemplate.subject,
                html: emailTemplate.html,
            });

            res.status(200).json({
                success: true,
                message: 'Password reset email sent successfully',
            });
        } catch (error) {
            console.error('❌ Error sending password reset email:', error);

            // Clear reset token if email fails
            user.resetPasswordToken = undefined;
            user.resetPasswordExpire = undefined;
            await user.save({ validateBeforeSave: false });

            return res.status(500).json({
                success: false,
                message: 'Email could not be sent. Please try again later.',
            });
        }
    } catch (error) {
        next(error);
    }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password/:token
// @access  Public
exports.resetPassword = async (req, res, next) => {
    try {
        const { password } = req.body;
        const crypto = require('crypto');

        if (!password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a new password',
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long',
            });
        }

        // Hash the token from URL to match with database
        const resetPasswordToken = crypto
            .createHash('sha256')
            .update(req.params.token)
            .digest('hex');

        // Find user with valid token and not expired
        const user = await User.findOne({
            resetPasswordToken,
            resetPasswordExpire: { $gt: Date.now() },
        }).select('+resetPasswordToken +resetPasswordExpire');

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token',
            });
        }

        // Set new password
        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        // Generate new auth tokens
        const token = generateToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        res.status(200).json({
            success: true,
            message: 'Password reset successful',
            data: {
                token,
                refreshToken,
            },
        });
    } catch (error) {
        next(error);
    }
};
