/**
 * RecoverX Agent Orchestrator (src/agent.js)
 * Ties together the 7 tools, LLM tool-calling loop, per-session rate limiting,
 * structured reasoning records, and session history management.
 */

const { TOOL_DEFINITIONS } = require('./tools/schema');
const tools = require('./tools');
const { getSessionHistory, saveSessionHistory } = require('./session/manager');
const { checkSessionRateLimit } = require('./middleware/rateLimiter');

// Strict Whitelist of Allowed Tools
const TOOL_MAP = {
  get_product: tools.getProduct,
  check_stock: tools.checkStock,
  apply_discount: tools.applyDiscount,
  create_order: tools.createOrder,
  retry_payment: tools.retryPayment,
  suggest_alternative: tools.suggestAlternative,
  escalate_to_human: tools.escalateToHuman,
};

const SYSTEM_PROMPT = `You are RecoverX, an autonomous AI revenue recovery agent embedded in merchant checkout flows.
Your goal is to assist customers, prevent lost sales, resolve payment declines, and safely build orders.

CRITICAL OPERATIONAL RULES:
1. You can ONLY use the 7 provided tools: get_product, check_stock, apply_discount, create_order, retry_payment, suggest_alternative, escalate_to_human.
2. Never invent tool names or execute arbitrary code.
3. For every tool call you make, always supply a plain-language "reason" explaining your decision to the merchant and customer.
4. If a discount is requested, apply it using apply_discount. Discounts ≤15% auto-approve; discounts >15% will be gated for human approval.
5. If order creation is requested, orders ≤₹5,000 auto-approve; orders >₹5,000 will be gated for human approval.
6. Always explain outcomes clearly in polite, helpful natural language.`;

/**
 * Execute a specific tool with strict whitelist dispatch and structured reasoning capture.
 */
async function executeToolCall(toolName, args, sessionId, options = {}) {
  const handler = TOOL_MAP[toolName];
  if (!handler) {
    throw new Error(`Forbidden tool execution: '${toolName}' is not an authorized RecoverX tool.`);
  }

  // Enforce per-session tool call rate limit (10 calls/min)
  const rateLimit = await checkSessionRateLimit(sessionId);
  if (!rateLimit.allowed) {
    return {
      tool: toolName,
      input: args,
      reasoning: args.reason || 'Tool execution requested',
      requires_gate: false,
      result: { success: false, error: rateLimit.error, rateLimited: true },
      timestamp: new Date().toISOString(),
    };
  }

  let result;
  switch (toolName) {
    case 'get_product':
      result = await handler(args.productId, options);
      break;
    case 'check_stock':
      result = await handler(args.productId, args.quantity || 1, options);
      break;
    case 'apply_discount':
      result = await handler(args.orderValue, args.discountPct, args.reason);
      break;
    case 'create_order':
      result = await handler(args.cartItems, args.customerId || 'guest', options);
      break;
    case 'retry_payment':
      result = await handler(args.paymentId, args.method || 'CARD', options);
      break;
    case 'suggest_alternative':
      result = await handler(args.productId, options);
      break;
    case 'escalate_to_human':
      result = await handler(args.reason, args.orderContext || {});
      break;
    default:
      throw new Error(`Unhandled tool: ${toolName}`);
  }

  const requiresGate = result.status === 'REQUIRES_GATE' || result.gated === true;

  const actionRecord = {
    tool: toolName,
    input: args,
    reasoning: args.reason || `Executed ${toolName} for customer session.`,
    requires_gate: requiresGate,
    result,
    timestamp: new Date().toISOString(),
  };

  return actionRecord;
}

/**
 * Deterministic reasoning engine when running without OpenAI API key or during local tests.
 */
async function fallbackReasoningEngine(userMessage, conversationHistory, sessionId, customerId, options = {}) {
  const text = userMessage.toLowerCase();
  const actions = [];
  let reply = '';

  // 1. Discount request pattern
  const discountMatch = text.match(/(\d+)\s*%/i) || text.match(/(\d+)\s*percent/i) || text.match(/discount.*?(\d+)/i);
  if (discountMatch && (text.includes('discount') || text.includes('%') || text.includes('off'))) {
    const discountPct = parseInt(discountMatch[1], 10);
    const withoutDiscount = text.replace(discountMatch[0], '');
    const orderValMatch = withoutDiscount.match(/₹\s*(\d+)/i) || withoutDiscount.match(/order.*?(\d+)/i) || withoutDiscount.match(/(\d+)/);
    const orderValue = orderValMatch ? parseInt(orderValMatch[1], 10) : 1000;

    const action = await executeToolCall('apply_discount', {
      orderValue,
      discountPct,
      reason: `Customer requested ${discountPct}% recovery discount`,
    }, sessionId, options);
    actions.push(action);

    if (action.requires_gate) {
      reply = `I would like to offer you a ${discountPct}% discount on your order of ₹${orderValue}, but because this exceeds our automatic limit of 15%, I have submitted this request to our merchant manager for approval (Approval ID: ${action.result.approvalId}). You will be notified as soon as it is reviewed!`;
    } else {
      reply = `Great news! I have applied a ${discountPct}% discount to your order of ₹${orderValue}. Your new total is ₹${action.result.finalAmount} (you saved ₹${action.result.discountAmount}).`;
    }
    return { reply, actions };
  }

  // 2. Checkout / Create Order pattern
  if (text.includes('checkout') || text.includes('create order') || text.includes('place order') || text.includes('buy')) {
    let cartItems = options.cartItems;
    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      const priceMatch = text.match(/₹?\s*(\d+)/i);
      const price = priceMatch ? parseInt(priceMatch[1], 10) : 1299;
      cartItems = [{ id: 'prod_default', name: 'NovaCharge 65W GaN Fast Charger', price, quantity: 1 }];
    }

    const action = await executeToolCall('create_order', {
      cartItems,
      customerId,
      reason: 'Customer initiated checkout',
    }, sessionId, options);
    actions.push(action);

    if (action.requires_gate) {
      reply = `Your order total is ₹${action.result.totalAmount}, which exceeds our automatic checkout threshold of ₹5,000. I have paused the order and queued it for merchant authorization (Approval ID: ${action.result.approvalId}).`;
    } else {
      const orderId = action.result.order ? action.result.order.orderId : 'ord_created';
      reply = `Your order has been created successfully! Total amount: ₹${action.result.totalAmount}. Order ID: ${orderId}. Ready to proceed to payment.`;
    }
    return { reply, actions };
  }

  // 3. Payment retry pattern
  if (text.includes('retry payment') || text.includes('pay again') || text.includes('retry with') || text.includes('retry')) {
    const method = text.includes('upi') ? 'UPI' : (text.includes('netbanking') ? 'NETBANKING' : 'CARD');
    const paymentId = options.paymentId || `pay_${sessionId}`;
    const action = await executeToolCall('retry_payment', {
      paymentId,
      method,
      reason: `Customer requested payment retry using ${method}`,
    }, sessionId, options);
    actions.push(action);

    if (action.result.status === 'REJECTED') {
      reply = `Unable to retry payment: ${action.result.reason}`;
    } else {
      reply = `Payment retry attempt ${action.result.attemptNumber} of 2 has been initiated using ${method}. Please complete the transaction.`;
    }
    return { reply, actions };
  }

  // 4. Stock check pattern
  if (text.includes('check stock') || text.includes('stock of') || text.includes('in stock') || text.includes('stock')) {
    const productId = options.productId || '74057759-4566-4bba-9767-f3c22c880641';
    const action = await executeToolCall('check_stock', {
      productId,
      quantity: 1,
      reason: 'Verifying stock availability for customer',
    }, sessionId, options);
    actions.push(action);

    if (action.result.available) {
      reply = `Yes, "${action.result.productName}" is currently in stock (${action.result.currentStock} units available).`;
    } else {
      reply = `Sorry, "${action.result.productName}" is currently out of stock. Would you like me to suggest similar alternatives?`;
    }
    return { reply, actions };
  }

  // 5. Product lookup pattern
  if (text.includes('show') || text.includes('charger') || text.includes('product') || text.includes('headphones') || text.includes('webcam')) {
    const productId = options.productId || '74057759-4566-4bba-9767-f3c22c880641';
    const action = await executeToolCall('get_product', {
      productId,
      reason: 'Looking up product catalog details',
    }, sessionId, options);
    actions.push(action);

    if (action.result.success && action.result.product) {
      const p = action.result.product;
      reply = `Here are the details for ${p.name}: Price: ₹${p.price}, Category: ${p.category}. Description: ${p.description} (Stock: ${p.stock_quantity} units).`;
    } else {
      reply = `I could not locate that product in our catalog.`;
    }
    return { reply, actions };
  }

  // 6. Alternative suggestion pattern
  if (text.includes('alternative') || text.includes('substitute') || text.includes('similar')) {
    const productId = options.productId || '74057759-4566-4bba-9767-f3c22c880641';
    const action = await executeToolCall('suggest_alternative', {
      productId,
      reason: 'Finding in-stock alternatives for customer',
    }, sessionId, options);
    actions.push(action);

    reply = `I found ${action.result.count} in-stock alternative(s) in category '${action.result.category}'.`;
    return { reply, actions };
  }

  // 7. Human escalation pattern
  if (text.includes('human') || text.includes('manager') || text.includes('help') || text.includes('support') || text.includes('agent')) {
    const action = await executeToolCall('escalate_to_human', {
      reason: userMessage,
      orderContext: { sessionId, customerId },
    }, sessionId, options);
    actions.push(action);

    reply = `I have escalated your request to our merchant support team (Approval ID: ${action.result.approvalId}). An agent will reach out shortly.`;
    return { reply, actions };
  }

  // Default conversational reply
  reply = `Hello! I'm your RecoverX shopping and checkout assistant. I can look up products, check real-time stock, apply recovery discounts, manage payments, and assist with your checkout. How can I help you today?`;
  return { reply, actions };
}

/**
 * Main Chat Handler with LLM Tool-Calling Loop.
 */
async function processChatMessage({ message, sessionId, customerId = 'guest', options = {} }) {
  if (!message || typeof message !== 'string') {
    throw new Error('Missing or invalid message string.');
  }

  const sid = sessionId || `sess_${Date.now()}`;

  // 1. Retrieve session history
  const history = await getSessionHistory(sid);

  // Append user message
  const userMsgObj = { role: 'user', content: message };
  const updatedHistory = [...history, userMsgObj];

  let reply = '';
  let actions = [];

  const apiKey = process.env.OPENAI_API_KEY;
  const isRealKey = apiKey && apiKey.startsWith('sk-') && !apiKey.includes('REPLACE_ME');

  if (isRealKey) {
    try {
      const { OpenAI } = require('openai');
      const openai = new OpenAI({ apiKey });

      const messagesForLLM = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...updatedHistory.slice(-10),
      ];

      // First LLM call with tools
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: messagesForLLM,
        tools: TOOL_DEFINITIONS,
        tool_choice: 'auto',
      });

      const choice = completion.choices[0];
      const responseMsg = choice.message;

      // Handle tool calling loop
      if (responseMsg.tool_calls && responseMsg.tool_calls.length > 0) {
        messagesForLLM.push(responseMsg);

        for (const toolCall of responseMsg.tool_calls) {
          const fnName = toolCall.function.name;
          let fnArgs = {};
          try {
            fnArgs = JSON.parse(toolCall.function.arguments);
          } catch (e) {
            fnArgs = {};
          }

          const actionRecord = await executeToolCall(fnName, fnArgs, sid, options);
          actions.push(actionRecord);

          // Feed tool response back into LLM messages
          messagesForLLM.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: fnName,
            content: JSON.stringify(actionRecord.result),
          });
        }

        // Second LLM call for final natural language response
        const secondCompletion = await openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: messagesForLLM,
        });

        reply = secondCompletion.choices[0].message.content || '';
      } else {
        reply = responseMsg.content || '';
      }
    } catch (err) {
      console.warn('OpenAI call failed or key invalid, using fallback engine:', err.message);
      const fallback = await fallbackReasoningEngine(message, updatedHistory, sid, customerId, options);
      reply = fallback.reply;
      actions = fallback.actions;
    }
  } else {
    // Run deterministic reasoning engine (offline / testing mode)
    const fallback = await fallbackReasoningEngine(message, updatedHistory, sid, customerId, options);
    reply = fallback.reply;
    actions = fallback.actions;
  }

  // Append assistant message and persist history
  updatedHistory.push({ role: 'assistant', content: reply });
  await saveSessionHistory(sid, updatedHistory);

  return {
    success: true,
    sessionId: sid,
    reply,
    actions,
    historyLength: updatedHistory.length,
  };
}

module.exports = {
  processChatMessage,
  executeToolCall,
  TOOL_MAP,
};
