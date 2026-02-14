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
        let businessIdForStaff = null;

        // If registering via invite
        if (inviteToken) {
            const Staff = require('../models/Staff');
            const staff = await Staff.findOne({
                inviteToken,
                inviteStatus: 'pending'
            });

            if (staff) {
                userRole = 'staff';
                businessIdForStaff = staff.businessId;
            }
        }

        // Create user (DO NOT set businessId for staff - they access via X-Business-Id header)
        const user = await User.create({
            name,
            email,
            password,
            role: userRole,
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

        // Send response immediately
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

        // Send welcome email asynchronously (don't block response)
        if (userRole === 'owner') {
            // Fire and forget - send email in background using system Gmail
            setImmediate(async () => {
                try {
                    const { sendWelcomeEmail } = require('../services/systemEmail.service');
                    await sendWelcomeEmail(email, name);
                    console.log('✅ Welcome email sent to:', email);
                } catch (emailError) {
                    console.error('❌ Failed to send welcome email:', emailError.message);
                }
            });
        }
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
        let business = null;
        
        if (user.role === 'owner') {
            // For owners, get their business
            business = await Business.findOne({ owner: user._id });
        } else if (user.role === 'staff') {
            // For staff, get the business they're assigned to (but don't set user.businessId)
            const Staff = require('../models/Staff');
            const staffRecord = await Staff.findOne({
                userId: user._id,
                inviteStatus: 'accepted',
                status: 'active'
            }).populate('businessId');
            
            if (staffRecord && staffRecord.businessId) {
                business = staffRecord.businessId;
                // DO NOT set user.businessId for staff - they access via X-Business-Id header
            }
        }

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
            const { sendPasswordResetEmail } = require('../services/systemEmail.service');

            await sendPasswordResetEmail(user.email, resetToken);

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
