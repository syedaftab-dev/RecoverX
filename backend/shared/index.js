// Shared constants, event names and validation definitions
module.exports = {
  SERVICES: {
    CATALOG: 'catalog-service',
    AGENT: 'agent-service',
    PAYMENT: 'payment-service',
    AUDIT: 'audit-service',
  },
  PORTS: {
    CATALOG: 4001,
    AGENT: 4002,
    PAYMENT: 4003,
    AUDIT: 4004,
    GATEWAY: 8080,
    FRONTEND: 5173,
  },
  SAFETY_BOUNDS: {
    MAX_AUTO_DISCOUNT_PERCENT: 15,
    MAX_AUTO_ORDER_VALUE: 5000,
  },
  EVENTS: {
    PAYMENT_FAILED: 'payment.failed',
    PAYMENT_SUCCESS: 'payment.success',
    RECOVERY_INITIATED: 'recovery.initiated',
    RECOVERY_ACTION_EXECUTED: 'recovery.action_executed',
    RECOVERY_GATED_APPROVAL_NEEDED: 'recovery.gated_approval_needed',
    AUDIT_LOG_RECORDED: 'audit.log_recorded',
  },
};
