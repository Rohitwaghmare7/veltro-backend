const Staff = require('../models/Staff');
const User = require('../models/User');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');

// @desc    Get all staff members
// @route   GET /api/staff
// @access  Private (Owner/Manager)
exports.getStaff = async (req, res, next) => {
    try {
        const staff = await Staff.find({ businessId: req.businessId })
            .sort({ createdAt: -1 });

        // Check and update expired invites
        const updates = [];
        staff.forEach(member => {
            if (member.isInviteExpired() && member.inviteStatus === 'pending') {
                member.inviteStatus = 'expired';
                updates.push(member.save());
            }
        });
        
        if (updates.length > 0) {
            await Promise.all(updates);
        }

        res.json({ success: true, data: staff, count: staff.length });
    } catch (error) {
        next(error);
    }
};

// @desc    Invite new staff member
// @route   POST /api/staff
// @access  Private (Owner only)
exports.inviteStaff = async (req, res, next) => {
    try {
        // Simple permission check: Only owners can invite for now
        // In a real app, check req.user.role or staff permissions
        if (req.user.role !== 'owner') {
            // allow if they have permission? For now let's strict to owner or check permissions
            // Let's assume req.user is populated. If it's a staff member ensuring they have 'canManageStaff' (not in schema yet, but let's stick to Owner for MVP safety)
        }

        const { name, email, permissions } = req.body;

        // Check if already added
        const existingStaff = await Staff.findOne({
            businessId: req.businessId,
            email: email.toLowerCase()
        });

        if (existingStaff) {
            return res.status(400).json({ success: false, message: 'Staff member already exists' });
        }

        // Check if user exists in system
        const existingUser = await User.findOne({ email: email.toLowerCase() });

        // Generate fake invite token
        const inviteToken = crypto.randomBytes(20).toString('hex');

        const staff = await Staff.create({
            businessId: req.businessId,
            userId: existingUser ? existingUser._id : null,
            name,
            email: email.toLowerCase(),
            permissions,
            inviteToken,
            inviteStatus: 'pending',
        });

        // Send Email
        const inviteUrl = `${process.env.CLIENT_URL}/invite/${inviteToken}`;
        const message = `You have been invited to join ${req.user.name}'s team on Veltro.\n\nPlease click the link below to accept the invitation:\n\n${inviteUrl}`;

        try {
            await sendEmail({
                email: staff.email,
                subject: 'Team Invitation - Veltro',
                message,
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: auto;">
                        <h2>You're Invited!</h2>
                        <p>You have been invited to join a team on <strong>Veltro</strong>.</p>
                        <p>Click the button below to accept your invitation and get started:</p>
                        <a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">Accept Invitation</a>
                        <p>If the button doesn't work, copy and paste this link into your browser:</p>
                        <p>${inviteUrl}</p>
                    </div>
                `
            });
        } catch (err) {
            console.error('Email failed to send', err);
            // We still created the staff record, so user can resend or we can handle error
        }

        res.status(201).json({ success: true, data: staff });
    } catch (error) {
        next(error);
    }
};

// @desc    Update staff permissions
// @route   PUT /api/staff/:id
// @access  Private (Owner only)
exports.updateStaff = async (req, res, next) => {
    try {
        const { permissions } = req.body;

        const staff = await Staff.findOneAndUpdate(
            { _id: req.params.id, businessId: req.businessId },
            { permissions },
            { new: true }
        );

        if (!staff) {
            return res.status(404).json({ success: false, message: 'Staff not found' });
        }

        res.json({ success: true, data: staff });
    } catch (error) {
        next(error);
    }
};

// @desc    Deactivate staff member (soft delete)
// @route   PUT /api/staff/:id/deactivate
// @access  Private (Owner only)
exports.deactivateStaff = async (req, res, next) => {
    try {
        const staff = await Staff.findOneAndUpdate(
            { _id: req.params.id, businessId: req.businessId },
            { status: 'deactivated' },
            { new: true }
        );

        if (!staff) {
            return res.status(404).json({ success: false, message: 'Staff not found' });
        }

        res.json({ success: true, data: staff, message: 'Staff member deactivated' });
    } catch (error) {
        next(error);
    }
};

// @desc    Reactivate staff member
// @route   PUT /api/staff/:id/reactivate
// @access  Private (Owner only)
exports.reactivateStaff = async (req, res, next) => {
    try {
        const staff = await Staff.findOneAndUpdate(
            { _id: req.params.id, businessId: req.businessId },
            { status: 'active' },
            { new: true }
        );

        if (!staff) {
            return res.status(404).json({ success: false, message: 'Staff not found' });
        }

        res.json({ success: true, data: staff, message: 'Staff member reactivated' });
    } catch (error) {
        next(error);
    }
};

// @desc    Remove staff member (hard delete)
// @route   DELETE /api/staff/:id
// @access  Private (Owner only)
exports.removeStaff = async (req, res, next) => {
    try {
        const staff = await Staff.findOneAndDelete({
            _id: req.params.id,
            businessId: req.businessId
        });

        if (!staff) {
            return res.status(404).json({ success: false, message: 'Staff not found' });
        }

        res.json({ success: true, message: 'Staff member removed' });
    } catch (error) {
        next(error);
    }
};
// @desc    Accept invitation
// @route   POST /api/staff/accept/:token
// @access  Private (Logged in user)
exports.acceptInvite = async (req, res, next) => {
    try {
        // Find staff by token. Status could be 'pending' or 'accepted' (if just registered)
        const staff = await Staff.findOne({
            inviteToken: req.params.token,
            inviteStatus: { $in: ['pending', 'accepted'] }
        });

        if (!staff) {
            return res.status(404).json({ success: false, message: 'Invalid or expired invitation' });
        }

        // If it was pending, mark as accepted and link user
        if (staff.inviteStatus === 'pending') {
            staff.userId = req.user._id;
            staff.inviteStatus = 'accepted';
        }

        // Always clear the token once it's been used to land here
        staff.inviteToken = undefined;
        await staff.save();

        res.json({ success: true, message: 'Invitation accepted successfully' });
    } catch (error) {
        next(error);
    }
};

// @desc    Get public info about an invitation (for pre-filling register form)
// @route   GET /api/staff/invite/info/:token
// @access  Public
exports.getInviteInfo = async (req, res, next) => {
    try {
        const staff = await Staff.findOne({
            inviteToken: req.params.token,
            inviteStatus: 'pending'
        }).populate('businessId', 'name');

        if (!staff) {
            return res.status(404).json({ success: false, message: 'Invalid or expired invitation' });
        }

        res.json({
            success: true,
            data: {
                name: staff.name,
                email: staff.email,
                businessName: staff.businessId.name
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all businesses the user has access to (owned or staff)
// @route   GET /api/staff/businesses
// @access  Private
exports.getMyBusinesses = async (req, res, next) => {
    try {
        const Business = require('../models/Business');

        // 1. Get businesses where this user is the owner
        const ownedBusinesses = await Business.find({ owner: req.user._id }).select('name bookingSlug');

        // 2. Get businesses where user is staff (accepted invites)
        const staffRecords = await Staff.find({
            userId: req.user._id,
            inviteStatus: 'accepted'
        }).populate('businessId', 'name bookingSlug');

        const businesses = [];

        // Add owned businesses labeled as 'owner'
        ownedBusinesses.forEach(biz => {
            businesses.push({
                _id: biz._id,
                name: biz.name,
                role: 'owner'
            });
        });

        // Add staff businesses labeled as 'staff'
        staffRecords.forEach(record => {
            // Check if we already added this as owner (should not happen if data is clean)
            if (businesses.some(b => b._id.toString() === record.businessId?._id.toString())) return;

            if (record.businessId) {
                businesses.push({
                    _id: record.businessId._id,
                    name: record.businessId.name,
                    role: 'staff'
                });
            }
        });

        res.json({ success: true, data: businesses });
    } catch (error) {
        next(error);
    }
};

// @desc    Get current user's staff profile for a business
// @route   GET /api/staff/me
// @access  Private
exports.getStaffMe = async (req, res, next) => {
    try {
        // 1. Check if user is the owner of this business
        if (req.user.role === 'owner' && req.user.businessId?.toString() === req.businessId?.toString()) {
            return res.json({
                success: true,
                data: {
                    _id: 'owner-virtual-id',
                    name: req.user.name,
                    email: req.user.email,
                    role: 'owner',
                    inviteStatus: 'accepted',
                    permissions: {
                        canViewBookings: true,
                        canEditBookings: true,
                        canViewLeads: true,
                        canEditLeads: true,
                        canViewInbox: true,
                        canSendEmails: true,
                        canManageInventory: true,
                        canViewReports: true,
                        canManageAutomations: true
                    }
                }
            });
        }

        // 2. Otherwise find staff record
        const staff = await Staff.findOne({
            userId: req.user._id,
            businessId: req.businessId
        });

        if (!staff) {
            return res.status(404).json({ success: false, message: 'Staff profile not found for this business' });
        }

        res.json({ success: true, data: staff });
    } catch (error) {
        next(error);
    }
};
