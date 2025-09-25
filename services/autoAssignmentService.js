// backend/services/autoAssignmentService.js
const Admin = require('../models/Admin');
const Dispute = require('../models/Dispute');
const Notification = require('../models/Notification');
const emailNotificationService = require('./emailNotificationService');

class AutoAssignmentService {
    constructor() {
        this.isRunning = false;
        this.assignmentInterval = null;
    }

    // Start automatic assignment service
    start() {
        if (this.isRunning) {
            console.log('Auto assignment service is already running');
            return;
        }

        console.log('🚀 Starting automatic dispute assignment service...');
        this.isRunning = true;

        // Run assignment check every 5 minutes
        this.assignmentInterval = setInterval(async () => {
            try {
                await this.processAutoAssignment();
            } catch (error) {
                console.error('Error in auto assignment:', error);
            }
        }, 5 * 60 * 1000); // 5 minutes

        // Run initial assignment
        this.processAutoAssignment();
    }

    // Stop automatic assignment service
    stop() {
        if (this.assignmentInterval) {
            clearInterval(this.assignmentInterval);
            this.assignmentInterval = null;
        }
        this.isRunning = false;
        console.log('🛑 Automatic dispute assignment service stopped');
    }

    // Process automatic assignment
    async processAutoAssignment() {
        try {
            console.log('🔍 Checking for disputes that need assignment...');

            // Get unassigned disputes
            const unassignedDisputes = await Dispute.find({
                status: 'open',
                'assignment.assignedTo': { $exists: false }
            }).populate('order', 'orderId totalAmount');

            if (unassignedDisputes.length === 0) {
                console.log('✅ No unassigned disputes found');
                return;
            }

            console.log(`📋 Found ${unassignedDisputes.length} unassigned disputes`);

            // Get available staff
            const availableStaff = await Admin.find({
                isActive: true,
                'permissions.disputeResolution': true
            }).select('_id fullName role disputeSpecialties maxConcurrentDisputes activityStats');

            if (availableStaff.length === 0) {
                console.log('⚠️ No available staff found for assignment');
                return;
            }

            console.log(`👥 Found ${availableStaff.length} available staff members`);

            // Process each dispute
            for (const dispute of unassignedDisputes) {
                await this.assignDisputeToBestStaff(dispute, availableStaff);
            }

        } catch (error) {
            console.error('Error processing auto assignment:', error);
        }
    }

    // Assign dispute to the best available staff member
    async assignDisputeToBestStaff(dispute, availableStaff) {
        try {
            // Find best staff member for this dispute
            const bestStaff = this.findBestStaffForDispute(dispute, availableStaff);

            if (!bestStaff) {
                console.log(`⚠️ No suitable staff found for dispute ${dispute.disputeId}`);
                return;
            }

            // Check if staff can handle more disputes
            const currentWorkload = bestStaff.activityStats?.currentDisputes?.length || 0;
            if (currentWorkload >= bestStaff.maxConcurrentDisputes) {
                console.log(`⚠️ ${bestStaff.fullName} is at maximum capacity (${currentWorkload}/${bestStaff.maxConcurrentDisputes})`);
                return;
            }

            // Assign dispute
            await this.performAssignment(dispute, bestStaff);

        } catch (error) {
            console.error(`Error assigning dispute ${dispute.disputeId}:`, error);
        }
    }

    // Find the best staff member for a dispute
    findBestStaffForDispute(dispute, availableStaff) {
        // Score each staff member
        const scoredStaff = availableStaff.map(staff => {
            let score = 0;
            const currentWorkload = staff.activityStats?.currentDisputes?.length || 0;

            // Check if staff can handle this category
            const canHandle = staff.disputeSpecialties.includes(dispute.category) || 
                             staff.disputeSpecialties.includes('other');

            if (!canHandle) {
                return { staff, score: -1 }; // Cannot handle this category
            }

            // Base score for being able to handle the category
            score += 10;

            // Specialty match bonus
            if (staff.disputeSpecialties.includes(dispute.category)) {
                score += 20;
            }

            // Workload consideration (prefer less busy staff)
            const workloadRatio = currentWorkload / staff.maxConcurrentDisputes;
            score += (1 - workloadRatio) * 15;

            // Role priority (managers can handle more complex cases)
            if (staff.role === 'dispute_manager') {
                score += 5;
            } else if (staff.role === 'dispute_specialist') {
                score += 3;
            }

            // Priority consideration
            if (dispute.priority === 'urgent' && staff.role === 'dispute_manager') {
                score += 10;
            }

            return { staff, score };
        });

        // Filter out staff who can't handle the dispute
        const eligibleStaff = scoredStaff.filter(item => item.score > 0);

        if (eligibleStaff.length === 0) {
            return null;
        }

        // Sort by score (highest first)
        eligibleStaff.sort((a, b) => b.score - a.score);

        return eligibleStaff[0].staff;
    }

    // Perform the actual assignment
    async performAssignment(dispute, staff) {
        try {
            // Update dispute
            dispute.assignment = {
                assignedTo: staff._id,
                assignedAt: new Date(),
                assignedBy: null, // System assignment
                notes: `Automatically assigned to ${staff.fullName} based on specialty and workload`
            };
            dispute.status = 'assigned';
            dispute.lastActivity = new Date();

            // Add assignment message
            dispute.messages.push({
                sender: {
                    userId: staff._id,
                    userType: 'Admin'
                },
                message: `Dispute automatically assigned to ${staff.fullName}`,
                isInternal: true
            });

            await dispute.save();

            // Update staff activity stats
            if (!staff.activityStats) {
                staff.activityStats = {
                    currentDisputes: [],
                    disputesAssigned: 0,
                    disputesResolved: 0,
                    averageResolutionTime: 0,
                    lastActivity: new Date()
                };
            }

            staff.activityStats.currentDisputes.push(dispute._id);
            staff.activityStats.disputesAssigned += 1;
            staff.activityStats.lastActivity = new Date();
            await staff.save();

            // Create notification
            await this.createAssignmentNotification(dispute, staff);

            // Send real-time notification to assigned staff
            try {
                const { sendNotification } = require('../utils/notificationHelper');
                const io = require('../server').io; // Get io instance
                
                if (io) {
                    await sendNotification(io, {
                        recipientId: staff._id,
                        recipientType: 'Admin',
                        notificationType: 'DISPUTE_ASSIGNED',
                        args: [dispute.disputeId, staff.fullName]
                    });
                }
            } catch (notificationError) {
                console.error('⚠️ Dispute assignment notification error:', notificationError);
            }

            // Send email notification
            await emailNotificationService.sendDisputeAssignmentNotification(
                staff.email, 
                staff.fullName, 
                dispute
            );

            console.log(`✅ Assigned dispute ${dispute.disputeId} to ${staff.fullName}`);

        } catch (error) {
            console.error(`Error performing assignment for dispute ${dispute.disputeId}:`, error);
            throw error;
        }
    }

    // Create notification for assignment
    async createAssignmentNotification(dispute, staff) {
        try {
            const notification = new Notification({
                recipientId: staff._id,
                recipientType: 'Admin',
                title: 'New Dispute Assignment',
                message: `You have been assigned dispute ${dispute.disputeId}: ${dispute.title}`,
                orderId: dispute.orderId,
                read: false
            });

            await notification.save();
            console.log(`📧 Created assignment notification for ${staff.fullName}`);

        } catch (error) {
            console.error('Error creating assignment notification:', error);
        }
    }

    // Manual assignment with auto-selection
    async autoAssignDispute(disputeId) {
        try {
            const dispute = await Dispute.findOne({
                disputeId,
                status: 'open',
                'assignment.assignedTo': { $exists: false }
            });

            if (!dispute) {
                throw new Error('Dispute not found or already assigned');
            }

            const availableStaff = await Admin.find({
                isActive: true,
                'permissions.disputeResolution': true
            }).select('_id fullName role disputeSpecialties maxConcurrentDisputes activityStats');

            const bestStaff = this.findBestStaffForDispute(dispute, availableStaff);

            if (!bestStaff) {
                throw new Error('No suitable staff available for assignment');
            }

            await this.performAssignment(dispute, bestStaff);

            return {
                success: true,
                message: `Dispute assigned to ${bestStaff.fullName}`,
                assignedTo: bestStaff.fullName,
                assignedAt: new Date()
            };

        } catch (error) {
            console.error('Error in manual auto-assignment:', error);
            throw error;
        }
    }

    // Get assignment statistics
    async getAssignmentStats() {
        try {
            const stats = await Dispute.aggregate([
                {
                    $group: {
                        _id: {
                            status: '$status',
                            hasAssignment: { $cond: [{ $ifNull: ['$assignment.assignedTo', false] }, 'assigned', 'unassigned'] }
                        },
                        count: { $sum: 1 }
                    }
                }
            ]);

            const staffWorkload = await Admin.aggregate([
                {
                    $match: {
                        isActive: true,
                        'permissions.disputeResolution': true
                    }
                },
                {
                    $project: {
                        fullName: 1,
                        role: 1,
                        maxConcurrentDisputes: 1,
                        currentWorkload: { $size: { $ifNull: ['$activityStats.currentDisputes', []] } },
                        workloadPercentage: {
                            $multiply: [
                                { $divide: [{ $size: { $ifNull: ['$activityStats.currentDisputes', []] } }, '$maxConcurrentDisputes'] },
                                100
                            ]
                        }
                    }
                }
            ]);

            return {
                disputeStats: stats,
                staffWorkload,
                serviceStatus: {
                    isRunning: this.isRunning,
                    lastCheck: new Date()
                }
            };

        } catch (error) {
            console.error('Error getting assignment stats:', error);
            throw error;
        }
    }

    // Rebalance assignments (move disputes from overloaded staff to available staff)
    async rebalanceAssignments() {
        try {
            console.log('⚖️ Starting assignment rebalancing...');

            const staff = await Admin.find({
                isActive: true,
                'permissions.disputeResolution': true
            }).select('_id fullName role disputeSpecialties maxConcurrentDisputes activityStats');

            // Find overloaded staff
            const overloadedStaff = staff.filter(s => {
                const currentWorkload = s.activityStats?.currentDisputes?.length || 0;
                return currentWorkload > s.maxConcurrentDisputes;
            });

            // Find underloaded staff
            const underloadedStaff = staff.filter(s => {
                const currentWorkload = s.activityStats?.currentDisputes?.length || 0;
                return currentWorkload < s.maxConcurrentDisputes * 0.7; // Less than 70% capacity
            });

            if (overloadedStaff.length === 0 || underloadedStaff.length === 0) {
                console.log('✅ No rebalancing needed');
                return;
            }

            console.log(`🔄 Found ${overloadedStaff.length} overloaded and ${underloadedStaff.length} underloaded staff`);

            // Move disputes from overloaded to underloaded staff
            for (const overloaded of overloadedStaff) {
                const currentWorkload = overloaded.activityStats?.currentDisputes?.length || 0;
                const excess = currentWorkload - overloaded.maxConcurrentDisputes;

                if (excess <= 0) continue;

                // Get some disputes to reassign
                const disputesToReassign = await Dispute.find({
                    'assignment.assignedTo': overloaded._id,
                    status: { $in: ['assigned', 'under_review'] }
                }).limit(excess);

                for (const dispute of disputesToReassign) {
                    const bestStaff = this.findBestStaffForDispute(dispute, underloadedStaff);
                    
                    if (bestStaff) {
                        await this.reassignDispute(dispute, overloaded, bestStaff);
                    }
                }
            }

            console.log('✅ Assignment rebalancing completed');

        } catch (error) {
            console.error('Error in rebalancing:', error);
        }
    }

    // Reassign dispute from one staff to another
    async reassignDispute(dispute, fromStaff, toStaff) {
        try {
            // Remove from old staff
            if (fromStaff.activityStats?.currentDisputes) {
                fromStaff.activityStats.currentDisputes = fromStaff.activityStats.currentDisputes.filter(
                    id => id.toString() !== dispute._id.toString()
                );
                await fromStaff.save();
            }

            // Add to new staff
            if (!toStaff.activityStats) {
                toStaff.activityStats = {
                    currentDisputes: [],
                    disputesAssigned: 0,
                    disputesResolved: 0,
                    averageResolutionTime: 0,
                    lastActivity: new Date()
                };
            }

            toStaff.activityStats.currentDisputes.push(dispute._id);
            toStaff.activityStats.disputesAssigned += 1;
            toStaff.activityStats.lastActivity = new Date();
            await toStaff.save();

            // Update dispute
            dispute.assignment.assignedTo = toStaff._id;
            dispute.assignment.assignedAt = new Date();
            dispute.assignment.notes = `Reassigned from ${fromStaff.fullName} to ${toStaff.fullName} for workload balancing`;
            dispute.lastActivity = new Date();

            // Add reassignment message
            dispute.messages.push({
                sender: {
                    userId: toStaff._id,
                    userType: 'Admin'
                },
                message: `Dispute reassigned from ${fromStaff.fullName} to ${toStaff.fullName}`,
                isInternal: true
            });

            await dispute.save();

            // Create notifications
            await this.createAssignmentNotification(dispute, toStaff);

            console.log(`🔄 Reassigned dispute ${dispute.disputeId} from ${fromStaff.fullName} to ${toStaff.fullName}`);

        } catch (error) {
            console.error('Error reassigning dispute:', error);
            throw error;
        }
    }
}

// Create singleton instance
const autoAssignmentService = new AutoAssignmentService();

module.exports = autoAssignmentService;
