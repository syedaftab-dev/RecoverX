/**
 * OpenAI-compatible Tool Definitions for the 7 RecoverX Agent Tools.
 * Strictly limited to these 7 capabilities.
 */

const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'get_product',
      description: 'Fetch details (name, price, stock, description, category) of a product by ID from the catalog.',
      parameters: {
        type: 'object',
        properties: {
          productId: {
            type: 'string',
            description: 'The UUID or identifier of the product.',
          },
          reason: {
            type: 'string',
            description: 'Plain-language explanation of why this product is being looked up.',
          },
        },
        required: ['productId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_stock',
      description: 'Verify live stock inventory availability for a product and requested quantity.',
      parameters: {
        type: 'object',
        properties: {
          productId: {
            type: 'string',
            description: 'The UUID of the product.',
          },
          quantity: {
            type: 'integer',
            description: 'The number of units requested (defaults to 1).',
            default: 1,
          },
          reason: {
            type: 'string',
            description: 'Plain-language explanation for why inventory is being verified.',
          },
        },
        required: ['productId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'apply_discount',
      description: 'Calculate and apply a percentage discount on an order. Discounts ≤15% auto-approve; discounts >15% pause for human merchant gating.',
      parameters: {
        type: 'object',
        properties: {
          orderValue: {
            type: 'number',
            description: 'The original order value in INR (₹).',
          },
          discountPct: {
            type: 'number',
            description: 'The requested discount percentage (e.g., 10 for 10%, 20 for 20%).',
          },
          reason: {
            type: 'string',
            description: 'Plain-language business justification for offering this discount.',
          },
        },
        required: ['orderValue', 'discountPct', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_order',
      description: 'Create an order with cart items. Orders ≤₹5,000 auto-approve; orders >₹5,000 require human merchant gating.',
      parameters: {
        type: 'object',
        properties: {
          cartItems: {
            type: 'array',
            description: 'Array of cart items to purchase.',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                price: { type: 'number' },
                quantity: { type: 'integer' },
              },
              required: ['price'],
            },
          },
          customerId: {
            type: 'string',
            description: 'Customer identifier (or "guest").',
          },
          reason: {
            type: 'string',
            description: 'Plain-language explanation for creating the order.',
          },
        },
        required: ['cartItems'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'retry_payment',
      description: 'Initiate a payment retry with a selected method. Strict ceiling of 2 attempts total per payment ID.',
      parameters: {
        type: 'object',
        properties: {
          paymentId: {
            type: 'string',
            description: 'The identifier of the failed payment transaction.',
          },
          method: {
            type: 'string',
            enum: ['UPI', 'CARD', 'NETBANKING'],
            description: 'Payment method to retry with.',
            default: 'CARD',
          },
          reason: {
            type: 'string',
            description: 'Plain-language reason for selecting this retry method.',
          },
        },
        required: ['paymentId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'suggest_alternative',
      description: 'Find up to 3 in-stock fallback products in the same category when a stock-out occurs.',
      parameters: {
        type: 'object',
        properties: {
          productId: {
            type: 'string',
            description: 'The ID of the unavailable product.',
          },
          reason: {
            type: 'string',
            description: 'Plain-language explanation for suggesting alternatives.',
          },
        },
        required: ['productId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'escalate_to_human',
      description: 'Escalate an issue or out-of-bounds request to a human merchant for review. Always unblockable.',
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: 'Clear reason why human escalation is required.',
          },
          orderContext: {
            type: 'object',
            description: 'Relevant contextual data (orderId, cart, discount, customer).',
          },
        },
        required: ['reason'],
      },
    },
  },
];

module.exports = { TOOL_DEFINITIONS };
