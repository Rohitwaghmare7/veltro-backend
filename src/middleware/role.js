const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized',
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Role '${req.user.role}' is not authorized to access this resource`,
            });
        }

        next();
    };
};

/**
 * Check if user has specific permission
 * Owners always have all permissions
 * Staff permissions are checked from their Staff record
 */
const requirePermission = (permission) => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized',
            });
        }

        // Get business context from header or user's business
        const businessId = req.headers['x-business-id'] || req.user.businessId;

        if (!businessId) {
            return res.status(400).json({
                success: false,
                message: 'No business context provided',
            });
        }

        // Owners have all permissions for their business
        if (req.user.role === 'owner' && req.user.businessId?.toString() === businessId.toString()) {
            req.businessId = businessId;
            return next();
        }

        // Check if user is staff member with required permission
        const Staff = require('../models/Staff');
        const staff = await Staff.findOne({
            userId: req.user._id,
            businessId: businessId,
            inviteStatus: 'accepted',
            status: 'active'
        });

        if (!staff) {
            return res.status(403).json({
                success: false,
                message: 'No access to this business',
            });
        }

        // Map permission names to Staff model fields
        const permissionMap = {
            inbox: 'canViewInbox',
            bookings: 'canViewBookings',
            leads: 'canViewLeads',
            inventory: 'canManageInventory',
            reports: 'canViewReports',
            automations: 'canManageAutomations',
        };

        const permissionField = permissionMap[permission];
        
        if (!permissionField || !staff.permissions[permissionField]) {
            return res.status(403).json({
                success: false,
                message: `You don't have permission to access ${permission}`,
            });
        }

        // Set business context and staff permissions
        req.businessId = businessId;
        req.staffPermissions = staff.permissions;
        req.staffProfile = staff;
        
        next();
    };
};

module.exports = { authorize, requirePermission };
