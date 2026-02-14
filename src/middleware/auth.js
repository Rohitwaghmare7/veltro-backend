const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;

    // Check Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    // Check cookies
    else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Not authorized — no token provided',
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id).select('-password');

        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized — user not found',
            });
        }

        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Not authorized — invalid token',
        });
    }
};

// Check if user has specific staff permission (or any of the permissions if array)
const authorizeStaff = (permissions) => {
    return async (req, res, next) => {
        const perms = Array.isArray(permissions) ? permissions : [permissions];

        // Check if user is owner of the CURRENT context business
        const Business = require('../models/Business');
        const business = await Business.findById(req.businessId);
        
        if (business && business.owner.toString() === req.user._id.toString()) {
            // User is the owner - grant all permissions
            return next();
        }

        // User is not the owner, check staff permissions
        const Staff = require('../models/Staff');
        const staff = await Staff.findOne({
            userId: req.user._id,
            businessId: req.businessId
        });

        if (!staff) {
            return res.status(403).json({ success: false, message: 'Forbidden — Staff profile not found' });
        }

        const hasPermission = perms.some(p => staff.permissions[p] === true);

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: `Forbidden — Missing permissions: ${perms.join(' or ')}`
            });
        }

        // Attach staff permissions to req for controller use if needed
        req.staffPermissions = staff.permissions;
        next();
    };
};

/**
 * Middleware to set business context based on X-Business-Id header.
 * Allows users to switch between businesses they own or are staff in.
 */
const setBusinessContext = async (req, res, next) => {
    // Get businessId from header or from user's current businessId
    let businessId = req.headers['x-business-id'] || req.user.businessId;

    // If no businessId provided, try to find one the user has access to
    if (!businessId) {
        const Business = require('../models/Business');
        const ownedBusiness = await Business.findOne({ owner: req.user._id });
        if (ownedBusiness) {
            businessId = ownedBusiness._id.toString();
        }
    }

    if (!businessId) {
        return res.status(400).json({ success: false, message: 'No business context provided' });
    }

    try {
        const Business = require('../models/Business');
        
        // 1. Check if user is owner of this business
        const business = await Business.findById(businessId);
        if (business && business.owner.toString() === req.user._id.toString()) {
            req.businessId = businessId;
            return next();
        }

        // 2. Check if user is an accepted staff member for this business
        const Staff = require('../models/Staff');
        const staff = await Staff.findOne({
            businessId,
            userId: req.user._id,
            inviteStatus: 'accepted',
            status: 'active'
        });

        if (!staff) {
            return res.status(403).json({
                success: false,
                message: 'No access to this business context'
            });
        }

        req.businessId = businessId;
        req.staffPermissions = staff.permissions;
        next();
    } catch (error) {
        next(error);
    }
};

module.exports = { protect, authorizeStaff, setBusinessContext };
