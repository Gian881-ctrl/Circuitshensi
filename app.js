'use strict';

/* ================= NAVIGATION & CHAT DRAWER ================= */
const menu = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
function closeMenu(returnFocus = false) {
  navigation.classList.remove('is-open');
  menu.setAttribute('aria-expanded', 'false');
  if (returnFocus) menu.focus();
}
menu.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(open));
  navigation.classList.toggle('is-open', open);
});
navigation.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
matchMedia('(min-width: 761px)').addEventListener('change', event => { if (event.matches) closeMenu(); });

const chatToggle = document.querySelector('#chat-toggle');
const chatPanel = document.querySelector('#chat-panel');
function closeChat(returnFocus = false) {
  chatPanel.hidden = true;
  chatToggle.setAttribute('aria-expanded', 'false');
  if (returnFocus) chatToggle.focus();
}
chatToggle.addEventListener('click', () => {
  const opening = chatPanel.hidden;
  chatPanel.hidden = !opening;
  chatToggle.setAttribute('aria-expanded', String(opening));
  if (opening) document.querySelector('#close-chat').focus();
});
document.querySelector('#close-chat').addEventListener('click', () => closeChat(true));
document.querySelector('#chat-inquiry').addEventListener('click', () => {
  closeChat();
  document.querySelector('#customer-name').focus();
});

/* ================= EMAIL & FORMSPREE AUTOMATION CONFIG ================= */
const AUTOMATION_CONFIG = {
  FORMSPREE_ENDPOINT: 'https://formspree.io/f/xwlpvlgd',[cite: 4, 5]
  OWNER_EMAIL: 'giancastlo117@gmail.com', // Ang iyong Owner Gmail
  // Naka-dagdag na ang iyong mga tunay na EmailJS keys:
  EMAILJS_PUBLIC_KEY: 'T4ns6nIGTXCULdidV',
  EMAILJS_SERVICE_ID: 'service_f6v7jiz',
  EMAILJS_TEMPLATE_ID: 'template_twgq1qn'
};

if (window.emailjs && AUTOMATION_CONFIG.EMAILJS_PUBLIC_KEY !== 'YOUR_PUBLIC_KEY') {
  window.emailjs.init(AUTOMATION_CONFIG.EMAILJS_PUBLIC_KEY);
}

/* ================= BOOKING STATE & URL ACTION LINKS ================= */
const STORAGE_KEY = 'circuit_senshi_orders_v1';
const EMAIL_LOG_KEY = 'circuit_senshi_email_log_v1';
let activeOrderId = null;

function getOrders() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveOrders(orders) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  updateOwnerBadge();
}

function getEmailLogs() {
  try {
    return JSON.parse(localStorage.getItem(EMAIL_LOG_KEY) || '[]');
  } catch {
    return [];
  }
}

function showToast(message) {
  const toast = document.getElementById('system-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => { toast.hidden = true; }, 6000);
}

/* Lumilikha ng 1-Click Action Links para sa Gmail */
function buildActionUrl(order, actionType) {
  const baseUrl = window.location.origin + window.location.pathname;
  const payload = encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(order)))));
  return `${baseUrl}?order=${encodeURIComponent(order.id)}&action=${encodeURIComponent(actionType)}&data=${payload}#order-portal`;
}

/* Nagpapadala ng Automated Emails sa Customer at Owner */
async function dispatchAutomatedEmails({ eventTitle, order, customerMessage, ownerMessage }) {
  const timestamp = new Date().toLocaleString();
  const logs = getEmailLogs();

  const ownerAcceptUrl = buildActionUrl(order, 'owner-accept');
  const ownerCancelUrl = buildActionUrl(order, 'owner-cancel');
  const customerPortalUrl = buildActionUrl(order, 'customer-view');
  const customerCancelUrl = buildActionUrl(order, 'customer-cancel');

  logs.unshift({
    time: timestamp,
    subject: eventTitle,
    toCustomer: `${order.customerName} <${order.customerEmail}>`,
    toOwner: `Owner <${AUTOMATION_CONFIG.OWNER_EMAIL}>`,
    customerBody: customerMessage,
    ownerBody: ownerMessage
  });
  localStorage.setItem(EMAIL_LOG_KEY, JSON.stringify(logs.slice(0, 20)));
  renderEmailLogs();

  // 1. Ipadala sa Formspree (Backup Copy para sa Owner)
  try {
    await fetch(AUTOMATION_CONFIG.FORMSPREE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        _subject: `[Circuit Senshi] ${eventTitle} (${order.id})`,
        _replyto: order.customerEmail,
        orderReference: order.id,
        status: order.status,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        mobile: order.mobile,
        service: order.serviceName,
        amount: `₱${order.price.toFixed(2)}`,
        CLICK_TO_ACCEPT_REPAIR: ownerAcceptUrl,
        CLICK_TO_CANCEL_REPAIR: ownerCancelUrl,
        OPEN_CUSTOMER_PORTAL: customerPortalUrl,
        customerCopySent: customerMessage,
        ownerCopySent: ownerMessage
      })
    });
  } catch (err) {
    console.warn('Formspree sync notice:', err);
  }

  // 2. Ipadala sa Tunay na Customer Gmail sa pamamagitan ng EmailJS
  if (window.emailjs && AUTOMATION_CONFIG.EMAILJS_PUBLIC_KEY !== 'YOUR_PUBLIC_KEY') {
    try {
      await window.emailjs.send(AUTOMATION_CONFIG.EMAILJS_SERVICE_ID, AUTOMATION_CONFIG.EMAILJS_TEMPLATE_ID, {
        to_email: order.customerEmail,
        to_name: order.customerName,
        subject: eventTitle,
        order_id: order.id,
        service_name: order.serviceName,
        amount: `₱${order.price.toFixed(2)}`,
        status: order.status,
        message_body: `${customerMessage}\n\nCancel Booking Link: ${customerCancelUrl}`,
        action_link: customerPortalUrl
      });

      await window.emailjs.send(AUTOMATION_CONFIG.EMAILJS_SERVICE_ID, AUTOMATION_CONFIG.EMAILJS_TEMPLATE_ID, {
        to_email: AUTOMATION_CONFIG.OWNER_EMAIL,
        to_name: 'Circuit Senshi Owner',
        subject: `[OWNER ACTION] ${eventTitle}`,
        order_id: order.id,
        service_name: order.serviceName,
        amount: `₱${order.price.toFixed(2)}`,
        status: order.status,
        message_body: `${ownerMessage}\n\n✔ ACCEPT REPAIR LINK:\n${ownerAcceptUrl}\n\n✕ CANCEL SERVICE LINK:\n${ownerCancelUrl}`,
        action_link: ownerAcceptUrl
      });
    } catch (err) {
      console.warn('EmailJS send error:', err);
    }
  }

  showToast(`📧 Naipadala na ang automated email para sa ${order.id} (${eventTitle})`);
}

function renderEmailLogs() {
  const container = document.getElementById('automated-email-log');
  if (!container) return;
  const logs = getEmailLogs();
  if (!logs.length) {
    container.innerHTML = '<p class="muted">Waiting for booking activity...</p>';
    return;
  }

  container.innerHTML = logs.map(item => `
    <div class="email-log-entry">
      <small>${item.time} • Sent to <strong>${item.toCustomer}</strong> &amp; <strong>${item.toOwner}</strong></small>
      <strong>${item.subject}</strong>
      <p style="margin-top:4px;color:var(--muted);"><strong>Customer Copy:</strong> ${item.customerBody}</p>
      <p style="margin-top:2px;color:var(--muted);"><strong>Owner Copy:</strong> ${item.ownerBody}</p>
    </div>
  `).join('');
}

/* ================= FORM VALIDATION & SUBMISSION ================= */
const form = document.querySelector('#repair-form');
const fields = [
  { element: form.elements.customerName, error: 'name-error', message: 'Enter your name.' },
  { element: form.elements.customerEmail, error: 'email-error', message: 'Enter a valid email address.' },
  { element: form.elements.mobile, error: 'mobile-error', message: 'Enter your mobile number.' },
  { element: form.elements.device, error: 'device-error', message: 'Enter a device model or PCB project.' },
  { element: form.elements.issue, error: 'issue-error', message: 'Describe the issue or the project you have in mind.' }
];

function validate(field) {
  const value = field.element.value.trim();
  let message = value ? '' : field.message;

  if (value && field.element.name === 'customerEmail') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      message = 'Enter a valid email address (e.g. name@gmail.com).';
    }
  }
  if (value && field.element.name === 'mobile') {
    const digits = value.replace(/\D/g, '');
    if (!/^\+?[\d\s().-]+$/.test(value) || digits.length < 7 || digits.length > 15) {
      message = 'Enter a valid phone number with 7–15 digits.';
    }
  }
  document.getElementById(field.error).textContent = message;
  field.element.setAttribute('aria-invalid', String(Boolean(message)));
  return !message;
}

form.addEventListener('input', event => {
  const field = fields.find(item => item.element === event.target);
  if (field && field.element.getAttribute('aria-invalid') === 'true') validate(field);
});

function syncPaymentInfo() {
  const preference = form.elements.preference.value;
  document.querySelector('#payment-mail-in').hidden = preference !== 'mail-in';
  document.querySelector('#payment-local').hidden = preference !== 'local';
}
form.querySelectorAll('input[name="preference"]').forEach(input => {
  input.addEventListener('input', syncPaymentInfo);
});
document.querySelectorAll('[data-preference]').forEach(link => link.addEventListener('click', () => {
  form.elements.preference.value = link.dataset.preference;
  syncPaymentInfo();
}));

document.querySelectorAll('[data-service]').forEach(link => {
  link.addEventListener('click', () => {
    const key = link.dataset.service;
    const select = document.getElementById('service-package');
    const option = Array.from(select.options).find(opt => opt.dataset.key === key);
    if (option) select.value = option.value;
  });
});

window.addEventListener('pageshow', syncPaymentInfo);
form.addEventListener('reset', () => setTimeout(syncPaymentInfo, 0));
syncPaymentInfo();
form.noValidate = true;

// STAGE 1: Customer Submits Service Confirmation Request
form.addEventListener('submit', async event => {
  event.preventDefault();
  const invalid = fields.filter(field => !validate(field));
  if (invalid.length) {
    invalid[0].element.focus();
    return;
  }

  const [serviceName, priceStr] = form.elements.servicePackage.value.split('|');
  const newOrder = {
    id: 'CS-' + Math.floor(1000 + Math.random() * 9000),
    customerName: form.elements.customerName.value.trim(),
    customerEmail: form.elements.customerEmail.value.trim(),
    mobile: form.elements.mobile.value.trim(),
    serviceName,
    price: parseFloat(priceStr),
    device: form.elements.device.value.trim(),
    issue: form.elements.issue.value.trim(),
    preference: form.elements.preference.value,
    status: 'PENDING_OWNER_APPROVAL',
    createdAt: Date.now(),
    acceptedAt: null,
    paidAt: null,
    cancelledAt: null,
    paymentMethod: null,
    paymentRef: null,
    invoiceNo: null,
    holdingFeeDeducted: 0,
    netRefundAmount: 0
  };

  const orders = getOrders();
  orders.unshift(newOrder);
  saveOrders(orders);

  activeOrderId = newOrder.id;
  document.getElementById('lookup-id-input').value = newOrder.id;
  form.reset();
  syncPaymentInfo();

  switchPortalTab('customer');
  renderCustomerOrder(newOrder.id);
  renderOwnerDashboard();

  document.getElementById('order-portal').scrollIntoView({ behavior: 'smooth' });

  await dispatchAutomatedEmails({
    eventTitle: `Confirmation Request of Service Order [${newOrder.id}]`,
    order: newOrder,
    customerMessage: `Hi ${newOrder.customerName}, your service confirmation request for ${newOrder.serviceName} (${newOrder.device}) has been received. Status: PENDING OWNER APPROVAL. You can cancel this booking anytime using your Cancel button in the Order Portal (Ref: ${newOrder.id}).`,
    ownerMessage: `New repair confirmation request from ${newOrder.customerName} (${newOrder.mobile}). Click the ACCEPT link in this email or open the Owner Admin Control Panel to ACCEPT or CANCEL this service.`
  });
});

/* ================= STAGE 2: OWNER ACCEPT OR CANCEL SERVICE ================= */
window.handleOwnerAction = async function(orderId, action) {
  const orders = getOrders();
  const order = orders.find(o => o.id === orderId);
  if (!order) return;

  if (action === 'ACCEPT') {
    const customPriceInput = document.getElementById(`owner-price-${orderId}`);
    if (customPriceInput && parseFloat(customPriceInput.value) > 0) {
      order.price = parseFloat(customPriceInput.value);
    }
    order.status = 'ACCEPTED_AWAITING_PAYMENT';
    order.acceptedAt = Date.now();
    saveOrders(orders);

    activeOrderId = order.id;
    switchPortalTab('customer');
    renderCustomerOrder(order.id);
    renderOwnerDashboard();

    const tenPercent = (order.price * 0.10).toFixed(2);
    await dispatchAutomatedEmails({
      eventTitle: `Repair Accepted — Online Payment Link Sent [${order.id}]`,
      order,
      customerMessage: `Good news! Circuit Senshi accepted your repair (${order.serviceName}). Please complete your online payment of ₱${order.price.toFixed(2)} via GCash, Maya, or BDO/BPI in the Order Portal. WARNING: Once accepted, cancelling within 2 days incurs an automatic 10% service/holding fee deduction (₱${tenPercent}).`,
      ownerMessage: `You accepted Order ${order.id}. Online payment checkout (GCash/Bank/Maya) and the 2-day 10% cancellation policy warning have been automatically sent to ${order.customerEmail}.`
    });
  } else if (action === 'CANCEL') {
    order.status = 'CANCELLED_BY_OWNER';
    order.cancelledAt = Date.now();
    saveOrders(orders);

    renderCustomerOrder(order.id);
    renderOwnerDashboard();

    await dispatchAutomatedEmails({
      eventTitle: `Service Request Declined / Cancelled by Shop [${order.id}]`,
      order,
      customerMessage: `Your repair request (${order.id}) was cancelled by the shop owner. No payment was charged.`,
      ownerMessage: `You cancelled/declined Order ${order.id}. Automated notice sent to customer.`
    });
  }
};

/* ================= STAGE 3: CUSTOMER ONLINE PAYMENT & AUTO INVOICE RECEIPT ================= */
window.handleCustomerPayment = async function(orderId) {
  const orders = getOrders();
  const order = orders.find(o => o.id === orderId);
  if (!order) return;

  const selectedMethodEl = document.querySelector('input[name="onlinePayMethod"]:checked');
  const refInput = document.getElementById('payment-ref-input');
  const policyCheck = document.getElementById('policy-consent-check');

  const paymentMethod = selectedMethodEl ? selectedMethodEl.value : 'GCash Online';
  const paymentRef = refInput ? refInput.value.trim() : '';

  if (!paymentRef) {
    alert('Please enter your GCash, Maya, or Bank Transfer Reference Number to complete online payment.');
    if (refInput) refInput.focus();
    return;
  }
  if (!policyCheck || !policyCheck.checked) {
    alert('Please check the box acknowledging the 2-Day 10% Cancellation Holding Fee Policy.');
    return;
  }

  order.status = 'PAID_CONFIRMED';
  order.paidAt = Date.now();
  order.paymentMethod = paymentMethod;
  order.paymentRef = paymentRef;
  order.invoiceNo = 'INV-' + new Date().getFullYear() + '-' + Math.floor(10000 + Math.random() * 90000);

  saveOrders(orders);
  renderCustomerOrder(order.id);
  renderOwnerDashboard();
  openInvoiceModal(order.id);

  const tenPercent = (order.price * 0.10).toFixed(2);
  await dispatchAutomatedEmails({
    eventTitle: `Official Invoice Receipt [${order.invoiceNo}] — Order ${order.id}`,
    order,
    customerMessage: `Thank you for your online payment of ₱${order.price.toFixed(2)} via ${order.paymentMethod} (Ref: ${order.paymentRef}). Your Official Invoice Receipt (${order.invoiceNo}) has been generated. Reminder: Cancelling within 2 days of acceptance automatically deducts a 10% holding fee (₱${tenPercent}).`,
    ownerMessage: `[OWNER COPY - OFFICIAL INVOICE ${order.invoiceNo}] Customer ${order.customerName} paid ₱${order.price.toFixed(2)} online via ${order.paymentMethod} (Ref: ${order.paymentRef}).`
  });
};

/* ================= STAGE 4: CUSTOMER CANCELLATION & AUTO 10% DEDUCTION ================= */
window.handleCustomerCancel = async function(orderId) {
  const orders = getOrders();
  const order = orders.find(o => o.id === orderId);
  if (!order) return;

  if (order.status === 'PENDING_OWNER_APPROVAL') {
    if (!confirm(`Cancel booking request ${order.id}? Since the owner has not accepted it yet, there is no cancellation fee.`)) return;
    order.status = 'CANCELLED_BY_CUSTOMER_FREE';
    order.cancelledAt = Date.now();
    saveOrders(orders);

    renderCustomerOrder(order.id);
    renderOwnerDashboard();

    await dispatchAutomatedEmails({
      eventTitle: `Booking Cancelled by Customer (No Fee) [${order.id}]`,
      order,
      customerMessage: `Your booking request (${order.id}) has been cancelled prior to owner acceptance. No fee was charged.`,
      ownerMessage: `Customer ${order.customerName} cancelled pending request ${order.id} before acceptance.`
    });
    return;
  }

  const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
  const elapsedMs = Date.now() - (order.acceptedAt || order.createdAt);
  const isWithinTwoDays = elapsedMs <= twoDaysMs;
  const feeAmount = +(order.price * 0.10).toFixed(2);
  const netRefund = +(order.price - feeAmount).toFixed(2);

  const confirmed = confirm(
    `AUTOMATED 2-DAY CANCELLATION POLICY WARNING:\n\n` +
    `Your repair has already been accepted${order.paidAt ? ' and paid' : ''}. Cancelling ${isWithinTwoDays ? 'within 2 days (48 hours)' : 'now'} automatically deducts a 10% Service / Holding Fee:\n\n` +
    `• Service Total: ₱${order.price.toFixed(2)}\n` +
    `• 10% Holding Fee Deduction: -₱${feeAmount.toFixed(2)}\n` +
    `• Automated Net Refund: ₱${netRefund.toFixed(2)}\n\n` +
    `Proceed with automated cancellation and 10% deduction?`
  );
  if (!confirmed) return;

  order.status = 'CANCELLED_10_PERCENT_DEDUCTED';
  order.cancelledAt = Date.now();
  order.holdingFeeDeducted = feeAmount;
  order.netRefundAmount = netRefund;
  if (!order.invoiceNo) {
    order.invoiceNo = 'INV-' + new Date().getFullYear() + '-' + Math.floor(10000 + Math.random() * 90000);
  }

  saveOrders(orders);
  renderCustomerOrder(order.id);
  renderOwnerDashboard();
  openInvoiceModal(order.id);

  await dispatchAutomatedEmails({
    eventTitle: `Order Cancelled — Automatic 10% Holding Fee Deducted [${order.id}]`,
    order,
    customerMessage: `You cancelled confirmed Order ${order.id} within the 2-day policy window. Original Amount: ₱${order.price.toFixed(2)} | Less 10% Holding Fee: -₱${feeAmount.toFixed(2)} | Net Refund Issued: ₱${netRefund.toFixed(2)}. Updated Invoice Receipt (${order.invoiceNo}) has been generated.`,
    ownerMessage: `[OWNER COPY] Customer ${order.customerName} cancelled accepted Order ${order.id}. 10% service/holding fee (₱${feeAmount.toFixed(2)}) was automatically deducted. Net refund to customer: ₱${netRefund.toFixed(2)}.`
  });
};

/* ================= RENDER CUSTOMER & OWNER PORTAL VIEWS ================= */
function renderCustomerOrder(orderId) {
  const container = document.getElementById('customer-order-container');
  const orders = getOrders();
  const order = orders.find(o => o.id === (orderId || activeOrderId)) || orders[0];

  if (!order) {
    container.innerHTML = `<p class="muted">No active booking found. Submit the <strong>Service Confirmation Request</strong> form above to start.</p>`;
    return;
  }

  activeOrderId = order.id;
  const tenPercent = (order.price * 0.10).toFixed(2);

  let statusBadge = `<span class="status-pill status-pending">⏳ Pending Owner Approval</span>`;
  if (order.status === 'ACCEPTED_AWAITING_PAYMENT') {
    statusBadge = `<span class="status-pill status-accepted">✓ Accepted by Owner — Awaiting Online Payment</span>`;
  } else if (order.status === 'PAID_CONFIRMED') {
    statusBadge = `<span class="status-pill status-paid">✔ Paid Online &amp; Confirmed</span>`;
  } else if (order.status.includes('CANCELLED')) {
    statusBadge = `<span class="status-pill status-cancelled">✕ ${order.status.replaceAll('_', ' ')}</span>`;
  }

  let dynamicStageHTML = '';

  if (order.status === 'PENDING_OWNER_APPROVAL') {
    dynamicStageHTML = `
      <div class="policy-warning-banner">
        <strong>Confirmation Request Sent to You &amp; the Shop Owner</strong>
        Your request is awaiting owner review. As the shop owner, you can click the button below (or the link inside your Gmail) to accept or decline this service:
        <div style="margin-top:12px;">
          <button type="button" class="button button-small" onclick="switchPortalTab('owner'); renderOwnerDashboard();">🛠️ Open Owner Admin Control Panel to Accept / Cancel</button>
        </div>
      </div>
      <div class="action-btn-row">
        <button type="button" class="button button-small button-danger" onclick="handleCustomerCancel('${order.id}')">✕ Cancel Booking Request (Free before acceptance)</button>
      </div>
    `;
  }

  if (order.status === 'ACCEPTED_AWAITING_PAYMENT') {
    dynamicStageHTML = `
      <div class="policy-warning-banner">
        <strong>⚠️ Mandatory 2-Day / 10% Cancellation Fee Warning</strong>
        Your repair has been accepted by the owner! Please complete your online payment below. Note that once accepted, if you cancel within <strong>2 days (48 hours)</strong>, an automatic <strong>10% service/holding fee (₱${tenPercent})</strong> will be deducted from your payment.
      </div>

      <div class="payment-checkout-box">
        <h4>Automated Online Payment Checkout</h4>
        <p class="muted">Select your preferred online payment channel to generate your automated Official Invoice Receipt.</p>

        <div class="payment-methods-grid">
          <label class="pay-method-card">
            <input type="radio" name="onlinePayMethod" value="GCash Online" checked onchange="updatePaymentAccountInstructions(this.value)">
            <strong>GCash</strong>
            <small>Instant E-Wallet</small>
          </label>
          <label class="pay-method-card">
            <input type="radio" name="onlinePayMethod" value="BDO / BPI Bank Transfer" onchange="updatePaymentAccountInstructions(this.value)">
            <strong>BDO / BPI Bank</strong>
            <small>Online Banking / InstaPay</small>
          </label>
          <label class="pay-method-card">
            <input type="radio" name="onlinePayMethod" value="Maya Online Payment" onchange="updatePaymentAccountInstructions(this.value)">
            <strong>Maya</strong>
            <small>E-Wallet / Virtual Card</small>
          </label>
        </div>

        <div id="payment-account-box" class="account-instructions">
          <strong>GCash Express Checkout:</strong> Send <strong>₱${order.price.toFixed(2)}</strong> to <strong>0917-555-0199 (Gian Gonzales Castillo / Circuit Senshi)</strong> and enter your Reference No. below.
        </div>

        <div class="field">
          <label for="payment-ref-input">Online Payment Reference Number</label>
          <input type="text" id="payment-ref-input" placeholder="e.g. GCash Ref #90184429102">
        </div>

        <label class="policy-checkbox-row">
          <input type="checkbox" id="policy-consent-check" checked>
          <span>I understand that cancelling this accepted service within <strong>2 days</strong> will automatically deduct a <strong>10% service/holding fee (₱${tenPercent})</strong> from my payment.</span>
        </label>

        <div class="action-btn-row">
          <button type="button" class="button" onclick="handleCustomerPayment('${order.id}')">Pay ₱${order.price.toFixed(2)} Online &amp; Get Invoice Receipt <span aria-hidden="true">↗</span></button>
          <button type="button" class="button button-small button-danger" onclick="handleCustomerCancel('${order.id}')">✕ Cancel Booking (10% Fee Applies)</button>
        </div>
      </div>
    `;
  }

  if (order.status === 'PAID_CONFIRMED') {
    dynamicStageHTML = `
      <div class="policy-warning-banner">
        <strong>✔ Online Payment Confirmed &amp; Official Invoice Sent!</strong>
        Invoice <strong>${order.invoiceNo}</strong> has been automatically emailed to <strong>${order.customerEmail}</strong> and the Shop Owner. Cancelling within 2 days of confirmation automatically deducts <strong>10% (₱${tenPercent})</strong> as a service/holding fee.
      </div>
      <div class="action-btn-row">
        <button type="button" class="button button-small" onclick="openInvoiceModal('${order.id}')">🧾 View / Print Official Invoice Receipt (${order.invoiceNo})</button>
        <button type="button" class="button button-small button-danger" onclick="handleCustomerCancel('${order.id}')">✕ Cancel Booking Within 2 Days (Auto-Deduct 10% Fee)</button>
      </div>
    `;
  }

  if (order.status === 'CANCELLED_10_PERCENT_DEDUCTED') {
    dynamicStageHTML = `
      <div class="deduction-banner">
        <strong>Booking Cancelled Within 2 Days — Automatic 10% Holding Fee Deducted</strong>
        <p style="margin-top:6px;">• Original Payment / Booking Amount: <strong>₱${order.price.toFixed(2)}</strong></p>
        <p>• Less 10% Service / Holding Fee: <strong>-₱${order.holdingFeeDeducted.toFixed(2)}</strong></p>
        <p>• Automated Net Refund to Customer: <strong>₱${order.netRefundAmount.toFixed(2)}</strong></p>
      </div>
      <div class="action-btn-row">
        <button type="button" class="button button-small button-outline" onclick="openInvoiceModal('${order.id}')">🧾 View Updated Refund &amp; 10% Deduction Receipt</button>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="order-header-bar">
      <div>
        <span class="order-ref-badge">ORDER REFERENCE: ${order.id}</span>
        <h3>${order.serviceName}</h3>
      </div>
      ${statusBadge}
    </div>

    <div class="order-meta-grid">
      <div class="meta-item"><span>Customer</span><strong>${order.customerName}</strong></div>
      <div class="meta-item"><span>Customer Email</span><strong>${order.customerEmail}</strong></div>
      <div class="meta-item"><span>Device / Project</span><strong>${order.device} (${order.preference})</strong></div>
      <div class="meta-item"><span>Service Amount</span><strong>₱${order.price.toFixed(2)}</strong></div>
    </div>

    ${dynamicStageHTML}
  `;
}

window.updatePaymentAccountInstructions = function(method) {
  const box = document.getElementById('payment-account-box');
  const orders = getOrders();
  const order = orders.find(o => o.id === activeOrderId);
  const price = order ? order.price.toFixed(2) : '0.00';
  if (!box) return;

  if (method.includes('GCash')) {
    box.innerHTML = `<strong>GCash Express Checkout:</strong> Send <strong>₱${price}</strong> to <strong>0917-555-0199 (Gian Gonzales Castillo / Circuit Senshi)</strong> and enter your Reference No. below.`;
  } else if (method.includes('BDO')) {
    box.innerHTML = `<strong>BDO / BPI Online Bank Transfer:</strong> Transfer <strong>₱${price}</strong> to <strong>BDO Account #0045-8812-9014 (Circuit Senshi Tech Solutions)</strong> and enter your InstaPay/Confirmation No. below.`;
  } else {
    box.innerHTML = `<strong>Maya Online Checkout:</strong> Send <strong>₱${price}</strong> to <strong>0917-555-0199 (@circuitsenshi)</strong> and enter your Reference ID below.`;
  }
};

function renderOwnerDashboard() {
  const listEl = document.getElementById('owner-orders-list');
  if (!listEl) return;
  const orders = getOrders();
  updateOwnerBadge();

  if (!orders.length) {
    listEl.innerHTML = `<p class="muted">No service requests yet. Submit a repair request above to test the owner approval workflow.</p>`;
    return;
  }

  listEl.innerHTML = orders.map(order => `
    <div class="owner-order-item">
      <div class="owner-order-info">
        <span class="order-ref-badge">${order.id} • ${new Date(order.createdAt).toLocaleString()}</span>
        <h4>${order.serviceName} — ${order.device}</h4>
        <p><strong>Customer:</strong> ${order.customerName} (${order.customerEmail} / ${order.mobile})</p>
        <p><strong>Issue:</strong> ${order.issue}</p>
        <p><strong>Status:</strong> ${order.status.replaceAll('_', ' ')} ${order.invoiceNo ? `• <strong>Invoice: ${order.invoiceNo}</strong>` : ''}</p>
      </div>
      <div class="owner-order-actions">
        ${order.status === 'PENDING_OWNER_APPROVAL' ? `
          <div style="display:flex;flex-direction:column;gap:4px;">
            <label style="font-size:10px;color:var(--muted);">Final Quote (₱)</label>
            <input type="number" id="owner-price-${order.id}" value="${order.price}" style="width:110px;min-height:38px;padding:6px 10px;font-size:13px;">
          </div>
          <button type="button" class="button button-small" onclick="handleOwnerAction('${order.id}', 'ACCEPT')">✓ Accept Repair &amp; Send Payment Link</button>
          <button type="button" class="button button-small button-danger" onclick="handleOwnerAction('${order.id}', 'CANCEL')">✕ Cancel Service</button>
        ` : ''}
        ${order.invoiceNo ? `
          <button type="button" class="button button-small button-outline" onclick="openInvoiceModal('${order.id}')">🧾 Owner Copy of Invoice</button>
        ` : ''}
        <button type="button" class="button button-small button-outline" onclick="viewOrderAsCustomer('${order.id}')">👁️ Open in Customer View</button>
      </div>
    </div>
  `).join('');
}

window.viewOrderAsCustomer = function(orderId) {
  activeOrderId = orderId;
  switchPortalTab('customer');
  renderCustomerOrder(orderId);
};

function updateOwnerBadge() {
  const badge = document.getElementById('owner-badge-count');
  if (!badge) return;
  const pendingCount = getOrders().filter(o => o.status === 'PENDING_OWNER_APPROVAL').length;
  badge.textContent = String(pendingCount);
}

/* ================= INVOICE MODAL CONTROLS ================= */
window.openInvoiceModal = function(orderId) {
  const order = getOrders().find(o => o.id === orderId);
  if (!order) return;

  const modal = document.getElementById('invoice-modal');
  const stamp = document.getElementById('invoice-status-stamp');
  const body = document.getElementById('invoice-body-details');

  const isDeducted = order.status === 'CANCELLED_10_PERCENT_DEDUCTED';
  stamp.textContent = isDeducted ? 'CANCELLED (10% FEE DEDUCTED)' : 'PAID & CONFIRMED';
  stamp.classList.toggle('stamp-cancelled', isDeducted);

  body.innerHTML = `
    <div class="invoice-row"><span>Invoice Number</span><strong>${order.invoiceNo || 'PENDING'}</strong></div>
    <div class="invoice-row"><span>Order Reference ID</span><strong>${order.id}</strong></div>
    <div class="invoice-row"><span>Date Issued</span><strong>${new Date(order.paidAt || Date.now()).toLocaleString()}</strong></div>
    <div class="invoice-row"><span>Customer Name</span><strong>${order.customerName}</strong></div>
    <div class="invoice-row"><span>Customer Email</span><strong>${order.customerEmail}</strong></div>
    <div class="invoice-row"><span>Device &amp; Service</span><strong>${order.device} — ${order.serviceName}</strong></div>
    <div class="invoice-row"><span>Online Payment Method</span><strong>${order.paymentMethod || 'Online Portal'}</strong></div>
    <div class="invoice-row"><span>Payment Reference No.</span><strong>${order.paymentRef || 'N/A'}</strong></div>
    <div class="invoice-row total-row"><span>Total Service Amount Paid</span><span>₱${order.price.toFixed(2)}</span></div>
    ${isDeducted ? `
      <div class="invoice-row deduction-row"><span>Less: Automated 10% Cancellation Holding Fee (Within 2 Days)</span><span>-₱${order.holdingFeeDeducted.toFixed(2)}</span></div>
      <div class="invoice-row refund-row"><span>Net Automated Refund to Customer</span><span>₱${order.netRefundAddress || order.netRefundAmount.toFixed(2)}</span></div>
    ` : ''}
  `;

  modal.hidden = false;
};

document.getElementById('close-invoice-btn').addEventListener('click', () => {
  document.getElementById('invoice-modal').hidden = true;
});
document.getElementById('print-invoice-btn').addEventListener('click', () => {
  window.print();
});

/* ================= PORTAL TABS & ORDER LOOKUP ================= */
window.switchPortalTab = function(role) {
  const isCust = role === 'customer';
  document.getElementById('tab-customer').classList.toggle('is-active', isCust);
  document.getElementById('tab-owner').classList.toggle('is-active', !isCust);
  document.getElementById('panel-customer').hidden = !isCust;
  document.getElementById('panel-owner').hidden = isCust;
};

document.getElementById('tab-customer').addEventListener('click', () => switchPortalTab('customer'));
document.getElementById('tab-owner').addEventListener('click', () => {
  switchPortalTab('owner');
  renderOwnerDashboard();
});

document.getElementById('lookup-btn').addEventListener('click', () => {
  const val = document.getElementById('lookup-id-input').value.trim().toUpperCase();
  if (!val) return;
  switchPortalTab('customer');
  renderCustomerOrder(val);
});

/* Handle 1-Click Gmail Links */
function handleIncomingEmailActionLinks() {
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('order');
  const action = params.get('action');
  const encodedData = params.get('data');

  if (!orderId) return;

  const orders = getOrders();
  let existing = orders.find(o => o.id === orderId);

  if (!existing && encodedData) {
    try {
      existing = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(encodedData)))));
      orders.unshift(existing);
      saveOrders(orders);
    } catch (e) {
      console.warn('Could not decode order URL payload:', e);
    }
  }

  if (!existing) return;
  activeOrderId = existing.id;
  window.history.replaceState({}, document.title, window.location.pathname + '#order-portal');

  if (action === 'owner-accept' && existing.status === 'PENDING_OWNER_APPROVAL') {
    setTimeout(() => handleOwnerAction(existing.id, 'ACCEPT'), 300);
  } else if (action === 'owner-cancel' && existing.status === 'PENDING_OWNER_APPROVAL') {
    setTimeout(() => handleOwnerAction(existing.id, 'CANCEL'), 300);
  } else if (action === 'customer-cancel') {
    switchPortalTab('customer');
    renderCustomerOrder(existing.id);
    setTimeout(() => handleCustomerCancel(existing.id), 300);
  } else {
    switchPortalTab('customer');
    renderCustomerOrder(existing.id);
  }
}

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  const invModal = document.getElementById('invoice-modal');
  if (invModal && !invModal.hidden) invModal.hidden = true;
  else if (!chatPanel.hidden) closeChat(true);
  else if (menu.getAttribute('aria-expanded') === 'true') closeMenu(true);
});

document.addEventListener('click', event => {
  if (!chatPanel.hidden && !chatPanel.contains(event.target) && !chatToggle.contains(event.target)) closeChat();
});

// Initialize Portal on Page Load
renderCustomerOrder();
renderOwnerDashboard();
renderEmailLogs();
handleIncomingEmailActionLinks();
