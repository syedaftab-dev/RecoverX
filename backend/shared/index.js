// Shared utilities and constants for RecoverX services
module.exports = {
  SERVICES: {
    PAYMENT: 'payment-service',
    RECOVERY: 'recovery-service',
    AUDIT: 'audit-service',
    NOTIFICATION: 'notification-service',
  },
  EVENTS: {
    PAYMENT_FAILED: 'payment.failed',
    PAYMENT_SUCCESS: 'payment.success',
    RECOVERY_INITIATED: 'recovery.initiated',
    RECOVERY_ACTION_EXECUTED: 'recovery.action_executed',
    RECOVERY_GATED_APPROVAL_NEEDED: 'recovery.gated_approval_needed',
    AUDIT_LOG_RECORDED: 'audit.log_recorded',
    NOTIFICATION_SENT: 'notification.sent',
  },
};
