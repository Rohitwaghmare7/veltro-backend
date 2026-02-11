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
