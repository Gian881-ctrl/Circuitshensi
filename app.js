'use strict';

/* ================= NAVIGATION & CHAT DRAWER ================= */
const menu = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
function closeMenu(returnFocus = false) {
  if (!navigation || !menu) return;
  navigation.classList.remove('is-open');
  menu.setAttribute('aria-expanded', 'false');
  if (returnFocus) menu.focus();
}
if (menu && navigation) {
  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    navigation.classList.toggle('is-open', open);
  });
  navigation.addEventListener('click', event => {
    if (event.target.closest('a')) closeMenu();
  });
}
matchMedia('(min-width: 761px)').addEventListener('change', event => {
  if (event.matches) closeMenu();
});

const chatToggle = document.querySelector('#chat-toggle');
const chatPanel = document.querySelector('#chat-panel');
function closeChat(returnFocus = false) {
  if (!chatPanel || !chatToggle) return;
  chatPanel.hidden = true;
  chatToggle.setAttribute('aria-expanded', 'false');
  if (returnFocus) chatToggle.focus();
}
if (chatToggle && chatPanel) {
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
}

/* ================= EMAIL, PIN & FORMSPREE CONFIG ================= */
const AUTOMATION_CONFIG = {
  OWNER_PIN: 'gian1825', // Secret Owner Password
  OWNER_EMAIL: 'giancastillo116@gmail.com', // Your active Gmail address
  FORMSPREE_ENDPOINT: 'https://formspree.io/f/xwlpvlgd',
  EMAILJS_PUBLIC_KEY: 'T4ns6nIGTXCULdidV',
  EMAILJS_SERVICE_ID: 'service_f6v7jiz',
  EMAILJS_TEMPLATE_ID: 'template_twgq1qn'
};

function initEmailJS() {
  if (window.emailjs && AUTOMATION_CONFIG.EMAILJS_PUBLIC_KEY) {
    try {
      window.emailjs.init({ publicKey: AUTOMATION_CONFIG.EMAILJS_PUBLIC_KEY });
    } catch {
      window.emailjs.init(AUTOMATION_CONFIG.EMAILJS_PUBLIC_KEY);
    }
  }
}
initEmailJS();

/* ================= BOOKING STATE & OWNER AUTHENTICATION ================= */
const STORAGE_KEY = 'circuit_senshi_orders_v1';
const EMAIL_LOG_KEY = 'circuit_senshi_email_log_v1';
let activeOrderId = null;
let isOwnerAuthenticated = false;

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
  showToast._timer = setTimeout(() => {
    toast.hidden = true;
  }, 6000);
}

/* Clean, Spam-Safe Portal URL Builder (No giant Base64 strings) */
function buildCleanPortalUrl(order) {
  const baseUrl = window.location.origin + window.location.pathname;
  const params = new URLSearchParams({
    order: order.id,
    name: order.customerName,
    email: order.customerEmail,
    service: order.serviceName,
    device: order.device,
    price: String(order.price),
    status: order.status
  });
  return `${baseUrl}?${params.toString()}#order-portal`;
}

/* Dispatches exact Customer Emails (1, 2, 3) and Owner Emails (1, 2) */
async function dispatchAutomatedEmails({
  eventTitle,
  order,
  customerMessage,
  ownerMessage,
  sendToCustomer = false,
  sendToOwner = false
}) {
  initEmailJS();
  const timestamp = new Date().toLocaleString();
  const logs = getEmailLogs();
  const cleanPortalUrl = buildCleanPortalUrl(order);

  logs.unshift({
    time: timestamp,
    subject: eventTitle,
    toCustomer: sendToCustomer ? `${order.customerName} <${order.customerEmail}>` : 'No Customer Email',
    toOwner: sendToOwner ? `Owner <${AUTOMATION_CONFIG.OWNER_EMAIL}>` : 'No Owner Email',
    customerBody: customerMessage || '—',
    ownerBody: ownerMessage || '—'
  });
  localStorage.setItem(EMAIL_LOG_KEY, JSON.stringify(logs.slice(0, 20)));
  renderEmailLogs();

  // 1. Send Customer Email via EmailJS
  if (window.emailjs && sendToCustomer) {
    try {
      await window.emailjs.send(
        AUTOMATION_CONFIG.EMAILJS_SERVICE_ID,
        AUTOMATION_CONFIG.EMAILJS_TEMPLATE_ID,
        {
          to_email: order.customerEmail,
          to_name: order.customerName,
          name: 'Circuit Senshi Tech Solutions',
          email: AUTOMATION_CONFIG.OWNER_EMAIL,
          subject: eventTitle,
          order_id: order.id,
          service_name: `${order.serviceName} (${order.device})`,
          amount: `₱${order.price.toFixed(2)}`,
          status: order.status.replaceAll('_', ' '),
          message_body: customerMessage,
          action_link: cleanPortalUrl
        }
      );
    } catch (err) {
      console.warn('EmailJS Customer dispatch warning:', err);
    }
  }

  // 2. Send Owner Email via EmailJS + Formspree Backup
  if (sendToOwner) {
    if (window.emailjs) {
      try {
        await window.emailjs.send(
          AUTOMATION_CONFIG.EMAILJS_SERVICE_ID,
          AUTOMATION_CONFIG.EMAILJS_TEMPLATE_ID,
          {
            to_email: AUTOMATION_CONFIG.OWNER_EMAIL,
            to_name: 'Gian Castillo (Circuit Senshi Owner)',
            name: order.customerName,
            email: order.customerEmail,
            subject: `[OWNER] ${eventTitle}`,
            order_id: order.id,
            service_name: `${order.serviceName} (${order.device})`,
            amount: `₱${order.price.toFixed(2)}`,
            status: order.status.replaceAll('_', ' '),
            message_body: ownerMessage,
            action_link: cleanPortalUrl
          }
        );
      } catch (err) {
        console.warn('EmailJS Owner dispatch warning:', err);
      }
    }

    try {
      await fetch(AUTOMATION_CONFIG.FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          _subject: `[Circuit Senshi Owner Copy] ${eventTitle} (${order.id})`,
          orderReference: order.id,
          status: order.status,
          invoiceNumber: order.invoiceNo || 'Pending Payment',
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          mobile: order.mobile,
          service: order.serviceName,
          device: order.device,
          amount: `₱${order.price.toFixed(2)}`,
          details: ownerMessage,
          portalLink: cleanPortalUrl
        })
      });
    } catch (err) {
      console.warn('Formspree backup notice:', err);
    }
  }

  showToast(`📧 Automated notification sent: ${eventTitle}`);
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
      <small>${item.time} • Customer: <strong>${item.toCustomer}</strong> | Owner: <strong>${item.toOwner}</strong></small>
      <strong>${item.subject}</strong>
      <p style="margin-top:4px;color:var(--muted);"><strong>Customer Message:</strong> ${item.customerBody}</p>
      <p style="margin-top:2px;color:var(--muted);"><strong>Owner Message:</strong> ${item.ownerBody}</p>
    </div>
  `).join('');
}

/* ================= OWNER LOGIN MODAL CONTROLS ================= */
const ownerLoginBtn = document.getElementById('owner-login-btn');
const ownerAuthModal = document.getElementById('owner-auth-modal');
const ownerAuthForm = document.getElementById('owner-auth-form');
const ownerPassInput = document.getElementById('owner-password-input');
const ownerAuthError = document.getElementById('owner-auth-error');

ownerLoginBtn.addEventListener('click', () => {
  if (isOwnerAuthenticated) {
    switchPortalTab('owner');
    renderOwnerDashboard();
    return;
  }
  ownerAuthError.textContent = '';
  ownerPassInput.value = '';
  ownerAuthModal.hidden = false;
  setTimeout(() => ownerPassInput.focus(), 50);
});

document.getElementById('cancel-auth-btn').addEventListener('click', () => {
  ownerAuthModal.hidden = true;
});

ownerAuthForm.addEventListener('submit', event => {
  event.preventDefault();
  if (ownerPassInput.value.trim() === AUTOMATION_CONFIG.OWNER_PIN) {
    isOwnerAuthenticated = true;
    ownerAuthModal.hidden = true;
    document.getElementById('tab-owner').hidden = false;
    ownerLoginBtn.hidden = true;
    switchPortalTab('owner');
    renderOwnerDashboard();
    showToast('🔓 Owner Admin Panel unlocked.');
  } else {
    ownerAuthError.textContent = 'Incorrect Owner Password. Access denied.';
    ownerPassInput.focus();
  }
});

document.getElementById('lock-owner-btn').addEventListener('click', () => {
  isOwnerAuthenticated = false;
  document.getElementById('tab-owner').hidden = true;
  ownerLoginBtn.hidden = false;
  switchPortalTab('customer');
  showToast('🔒 Owner Admin Mode locked and hidden.');
});

document.getElementById('clear-demo-btn').addEventListener('click', () => {
  if (!confirm('Clear all test bookings and email logs for a fresh presentation?')) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(EMAIL_LOG_KEY);
  activeOrderId = null;
  renderCustomerOrder();
  renderOwnerDashboard();
  renderEmailLogs();
  showToast('🧹 All test bookings cleared for presentation!');
});

/* ================= FORM VALIDATION & SUBMISSION ================= */
const form = document.querySelector('#repair-form');
if (form) {
  form.removeAttribute('action');
  form.removeAttribute('method');
  form.noValidate = true;
}

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
document.querySelectorAll('[data-preference]').forEach(link => {
  link.addEventListener('click', () => {
    form.elements.preference.value = link.dataset.preference;
    syncPaymentInfo();
  });
});

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

/* ================= STAGE 1: SUBMIT REQUEST (CUSTOMER EMAIL #1 + OWNER EMAIL #1) ================= */
form.addEventListener('submit', async event => {
  event.preventDefault();
  event.stopPropagation();

  const invalid = fields.filter(field => !validate(field));
  if (invalid.length) {
    invalid[0].element.focus();
    return;
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  const originalBtnHTML = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending Confirmation Request...';

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

  // Customer Email #1 (Waiting for Owner Approval) + Owner Email #1 (Customer Request to Approve/Decline)
  await dispatchAutomatedEmails({
    eventTitle: `Service Confirmation Request — Waiting for Owner Approval [${newOrder.id}]`,
    order: newOrder,
    customerMessage:
      `Your repair confirmation request has been sent to Circuit Senshi and is currently WAITING FOR OWNER APPROVAL.\n\n` +
      `• Service Requested: ${newOrder.serviceName}\n` +
      `• Device / Project: ${newOrder.device} (${newOrder.preference})\n` +
      `• Issue Details: ${newOrder.issue}\n` +
      `• Estimated Amount: ₱${newOrder.price.toFixed(2)}\n\n` +
      `Once the owner approves your request, you will receive an approval email so you can proceed with online payment. You can also cancel your booking for free while it is still pending approval using the link below.`,
    ownerMessage:
      `NEW CUSTOMER SERVICE REQUEST — ACTION REQUIRED (APPROVE OR DECLINE)\n\n` +
      `• Customer: ${newOrder.customerName} (${newOrder.customerEmail} / ${newOrder.mobile})\n` +
      `• Service: ${newOrder.serviceName}\n` +
      `• Device: ${newOrder.device} (${newOrder.preference})\n` +
      `• Fault / Issue: ${newOrder.issue}\n` +
      `• Quoted Amount: ₱${newOrder.price.toFixed(2)}\n\n` +
      `Open the Order Portal link below and unlock Owner Admin (Password: gian1825) to APPROVE or DECLINE this request.`,
    sendToCustomer: true,
    sendToOwner: true
  });

  submitBtn.disabled = false;
  submitBtn.innerHTML = originalBtnHTML;
});

/* ================= STAGE 2: OWNER APPROVES REQUEST (CUSTOMER EMAIL #2) ================= */
window.handleOwnerAction = async function(orderId, action) {
  if (!isOwnerAuthenticated) return;

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

    // Customer Email #2 (Owner Approved -> Ready to Pay Online)
    await dispatchAutomatedEmails({
      eventTitle: `Repair Request Approved — Ready for Online Payment [${order.id}]`,
      order,
      customerMessage:
        `Good news! The owner has APPROVED your repair request for ${order.serviceName} (${order.device}).\n\n` +
        `Your booking is now ready for online payment:\n` +
        `• Approved Amount to Pay: ₱${order.price.toFixed(2)}\n` +
        `• Available Online Channels: GCash, BDO/BPI Bank Transfer, or Maya\n\n` +
        `IMPORTANT 2-DAY CANCELLATION POLICY:\n` +
        `Once your repair is approved and paid, cancelling within 2 days (48 hours) will automatically deduct a 10% service/holding fee (₱${tenPercent}).\n\n` +
        `Click the Order Portal link below to complete your online payment and receive your Official Invoice Receipt.`,
      ownerMessage: `You approved Order ${order.id}. Customer has been emailed to pay ₱${order.price.toFixed(2)} online.`,
      sendToCustomer: true,
      sendToOwner: false
    });
  } else if (action === 'CANCEL') {
    order.status = 'CANCELLED_BY_OWNER';
    order.cancelledAt = Date.now();
    saveOrders(orders);

    renderCustomerOrder(order.id);
    renderOwnerDashboard();

    await dispatchAutomatedEmails({
      eventTitle: `Service Request Declined by Shop [${order.id}]`,
      order,
      customerMessage: `We regret to inform you that your service request (${order.id}) for ${order.device} could not be accommodated at this time. No payment was charged.`,
      ownerMessage: `You declined Order ${order.id}.`,
      sendToCustomer: true,
      sendToOwner: false
    });
  }
};

/* ================= STAGE 3: CUSTOMER PAYS (CUSTOMER EMAIL #3 + OWNER EMAIL #2) ================= */
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
  const paidDateStr = new Date(order.paidAt).toLocaleString();

  // Customer Email #3 (Official Invoice Receipt) + Owner Email #2 (Tailored Copy of Invoice Receipt)
  const receiptSummary =
    `OFFICIAL INVOICE RECEIPT — ${order.invoiceNo}\n` +
    `----------------------------------------\n` +
    `• Order Reference: ${order.id}\n` +
    `• Date Paid: ${paidDateStr}\n` +
    `• Customer: ${order.customerName} (${order.customerEmail})\n` +
    `• Repair Service: ${order.serviceName}\n` +
    `• Device / Project: ${order.device} (${order.preference})\n` +
    `• Payment Method: ${order.paymentMethod}\n` +
    `• Payment Reference No.: ${order.paymentRef}\n` +
    `• Total Amount Paid: ₱${order.price.toFixed(2)}\n` +
    `----------------------------------------\n` +
    `2-Day Cancellation Policy: Cancelling within 2 days (48 hours) of confirmation automatically deducts a 10% holding fee (₱${tenPercent}).`;

  await dispatchAutomatedEmails({
    eventTitle: `Official Invoice Receipt [${order.invoiceNo}] — ${order.serviceName}`,
    order,
    customerMessage: `Thank you for your payment! Below is your Official Invoice Receipt for your repair:\n\n${receiptSummary}`,
    ownerMessage: `OWNER COPY OF OFFICIAL INVOICE RECEIPT\nCustomer ${order.customerName} has completed online payment. Below is your exact copy of the customer's invoice:\n\n${receiptSummary}`,
    sendToCustomer: true,
    sendToOwner: true
  });
};

/* ================= STAGE 4: CUSTOMER CANCELLATION & AUTO 10% DEDUCTION ================= */
window.handleCustomerCancel = async function(orderId) {
  const orders = getOrders();
  const order = orders.find(o => o.id === orderId);
  if (!order) return;

  if (order.status === 'PENDING_OWNER_APPROVAL') {
    if (!confirm(`Cancel booking request ${order.id}? Since the owner has not approved it yet, there is no cancellation fee.`)) return;
    order.status = 'CANCELLED_BY_CUSTOMER_FREE';
    order.cancelledAt = Date.now();
    saveOrders(orders);

    renderCustomerOrder(order.id);
    renderOwnerDashboard();
    showToast(`Booking ${order.id} cancelled (No fee).`);
    return;
  }

  const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
  const elapsedMs = Date.now() - (order.acceptedAt || order.createdAt);
  const isWithinTwoDays = elapsedMs <= twoDaysMs;
  const feeAmount = +(order.price * 0.10).toFixed(2);
  const netRefund = +(order.price - feeAmount).toFixed(2);

  const confirmed = confirm(
    `AUTOMATED 2-DAY CANCELLATION POLICY WARNING:\n\n` +
    `Your repair has already been approved${order.paidAt ? ' and paid' : ''}. Cancelling ${isWithinTwoDays ? 'within 2 days (48 hours)' : 'now'} automatically deducts a 10% Service / Holding Fee:\n\n` +
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

  const cancelBreakdown =
    `CANCELLATION & 10% HOLDING FEE RECEIPT (${order.invoiceNo})\n` +
    `• Order Reference: ${order.id} (${order.serviceName})\n` +
    `• Original Repair Amount: ₱${order.price.toFixed(2)}\n` +
    `• Less 10% Holding Fee (2-Day Policy): -₱${feeAmount.toFixed(2)}\n` +
    `• Net Automated Refund to Customer: ₱${netRefund.toFixed(2)}`;

  await dispatchAutomatedEmails({
    eventTitle: `Cancellation & 10% Holding Fee Receipt [${order.invoiceNo}]`,
    order,
    customerMessage: `Your confirmed repair booking (${order.id}) was cancelled within the 2-day window. A 10% holding fee has been automatically deducted:\n\n${cancelBreakdown}`,
    ownerMessage: `OWNER COPY — Customer ${order.customerName} cancelled confirmed Order ${order.id}. 10% holding fee was automatically deducted:\n\n${cancelBreakdown}`,
    sendToCustomer: true,
    sendToOwner: true
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

  let statusBadge = `<span class="status-pill status-pending">⏳ Waiting for Owner Approval</span>`;
  if (order.status === 'ACCEPTED_AWAITING_PAYMENT') {
    statusBadge = `<span class="status-pill status-accepted">✓ Approved by Owner — Ready for Payment</span>`;
  } else if (order.status === 'PAID_CONFIRMED') {
    statusBadge = `<span class="status-pill status-paid">✔ Paid Online &amp; Invoice Sent</span>`;
  } else if (order.status.includes('CANCELLED')) {
    statusBadge = `<span class="status-pill status-cancelled">✕ ${order.status.replaceAll('_', ' ')}</span>`;
  }

  let dynamicStageHTML = '';

  if (order.status === 'PENDING_OWNER_APPROVAL') {
    dynamicStageHTML = `
      <div class="policy-warning-banner">
        <strong>1. Confirmation Request Sent — Waiting for Owner Approval</strong>
        Your request has been emailed to you and the shop owner. Once the owner approves your repair, you will receive an approval email and online payment will unlock here automatically. You may cancel for free below while awaiting approval.
      </div>
      <div class="action-btn-row">
        <button type="button" class="button button-small button-danger" onclick="handleCustomerCancel('${order.id}')">✕ Cancel Booking Request (Free before approval)</button>
      </div>
    `;
  }

  if (order.status === 'ACCEPTED_AWAITING_PAYMENT') {
    dynamicStageHTML = `
      <div class="policy-warning-banner">
        <strong>2. Owner Approved Your Request — Ready for Online Payment!</strong>
        An approval email has been sent to <strong>${order.customerEmail}</strong>. Please complete your payment of <strong>₱${order.price.toFixed(2)}</strong> below. <br><em>Warning: Once approved, cancelling within 2 days (48 hours) automatically deducts a 10% service/holding fee (₱${tenPercent}).</em>
      </div>

      <div class="payment-checkout-box">
        <h4>Automated Online Payment Checkout</h4>
        <p class="muted">Select your preferred online payment method to receive your tailored Official Invoice Receipt via Gmail.</p>

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
          <span>I understand that cancelling this approved service within <strong>2 days</strong> will automatically deduct a <strong>10% service/holding fee (₱${tenPercent})</strong> from my payment.</span>
        </label>

        <div class="action-btn-row">
          <button type="button" class="button" onclick="handleCustomerPayment('${order.id}')">Pay ₱${order.price.toFixed(2)} Online &amp; Receive Invoice Receipt <span aria-hidden="true">↗</span></button>
          <button type="button" class="button button-small button-danger" onclick="handleCustomerCancel('${order.id}')">✕ Cancel Booking (10% Fee Applies)</button>
        </div>
      </div>
    `;
  }

  if (order.status === 'PAID_CONFIRMED') {
    dynamicStageHTML = `
      <div class="policy-warning-banner">
        <strong>3. Online Payment Confirmed — Official Invoice Receipt Sent!</strong>
        Official Invoice <strong>${order.invoiceNo}</strong> has been automatically emailed to <strong>${order.customerEmail}</strong> and a copy sent to the Shop Owner. Cancelling within 2 days of confirmation automatically deducts <strong>10% (₱${tenPercent})</strong> as a holding fee.
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

  if (!isOwnerAuthenticated) {
    listEl.innerHTML = `<p class="muted">🔒 Owner Admin Panel is locked.</p>`;
    return;
  }

  if (!orders.length) {
    listEl.innerHTML = `<p class="muted" style="margin-top:16px;">No service requests yet. Submit a repair request above to test the owner approval workflow.</p>`;
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
            <label style="font-size:10px;color:var(--muted);">Approved Amount (₱)</label>
            <input type="number" id="owner-price-${order.id}" value="${order.price}" style="width:110px;min-height:38px;padding:6px 10px;font-size:13px;">
          </div>
          <button type="button" class="button button-small" onclick="handleOwnerAction('${order.id}', 'ACCEPT')">✓ Approve &amp; Email Payment Link</button>
          <button type="button" class="button button-small button-danger" onclick="handleOwnerAction('${order.id}', 'CANCEL')">✕ Decline Request</button>
        ` : ''}
        ${order.invoiceNo ? `
          <button type="button" class="button button-small button-outline" onclick="openInvoiceModal('${order.id}')">🧾 Owner Copy of Invoice</button>
        ` : ''}
        <button type="button" class="button button-small button-outline" onclick="viewOrderAsCustomer('${order.id}')">👁️ Customer View</button>
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
  stamp.textContent = isDeducted ? 'CANCELLED (10% FEE DEDUCTED)' : 'OFFICIAL PAID RECEIPT';
  stamp.classList.toggle('stamp-cancelled', isDeducted);

  body.innerHTML = `
    <div class="invoice-row"><span>Official Invoice Number</span><strong>${order.invoiceNo || 'PENDING'}</strong></div>
    <div class="invoice-row"><span>Order Reference ID</span><strong>${order.id}</strong></div>
    <div class="invoice-row"><span>Date &amp; Time Issued</span><strong>${new Date(order.paidAt || Date.now()).toLocaleString()}</strong></div>
    <div class="invoice-row"><span>Customer Name</span><strong>${order.customerName}</strong></div>
    <div class="invoice-row"><span>Customer Gmail</span><strong>${order.customerEmail}</strong></div>
    <div class="invoice-row"><span>Respected Repair Service</span><strong>${order.serviceName}</strong></div>
    <div class="invoice-row"><span>Device / Project Model</span><strong>${order.device} (${order.preference})</strong></div>
    <div class="invoice-row"><span>Online Payment Method</span><strong>${order.paymentMethod || 'Online Portal'}</strong></div>
    <div class="invoice-row"><span>Payment Reference No.</span><strong>${order.paymentRef || 'N/A'}</strong></div>
    <div class="invoice-row total-row"><span>Total Repair Amount Paid</span><span>₱${order.price.toFixed(2)}</span></div>
    ${isDeducted ? `
      <div class="invoice-row deduction-row"><span>Less: Automated 10% Cancellation Holding Fee (Within 2 Days)</span><span>-₱${order.holdingFeeDeducted.toFixed(2)}</span></div>
      <div class="invoice-row refund-row"><span>Net Automated Refund to Customer</span><span>₱${order.netRefundAmount.toFixed(2)}</span></div>
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

/* ================= PORTAL TABS & CLEAN URL LOOKUP ================= */
window.switchPortalTab = function(role) {
  if (role === 'owner' && !isOwnerAuthenticated) return;
  const isCust = role === 'customer';
  document.getElementById('tab-customer').classList.toggle('is-active', isCust);
  document.getElementById('tab-owner').classList.toggle('is-active', !isCust);
  document.getElementById('panel-customer').hidden = !isCust;
  document.getElementById('panel-owner').hidden = isCust;
};

document.getElementById('tab-customer').addEventListener('click', () => switchPortalTab('customer'));
document.getElementById('tab-owner').addEventListener('click', () => {
  if (!isOwnerAuthenticated) return;
  switchPortalTab('owner');
  renderOwnerDashboard();
});

document.getElementById('lookup-btn').addEventListener('click', () => {
  const val = document.getElementById('lookup-id-input').value.trim().toUpperCase();
  if (!val) return;
  switchPortalTab('customer');
  renderCustomerOrder(val);
});

/* Restores order cleanly if opened from a Gmail link on another device */
function handleIncomingEmailLinks() {
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('order');
  if (!orderId) return;

  const orders = getOrders();
  let existing = orders.find(o => o.id === orderId);

  if (!existing && params.get('name')) {
    existing = {
      id: orderId,
      customerName: params.get('name') || 'Customer',
      customerEmail: params.get('email') || '',
      mobile: 'N/A',
      serviceName: params.get('service') || 'Repair Service',
      device: params.get('device') || 'Device',
      issue: 'Loaded from email link',
      preference: 'mail-in',
      price: parseFloat(params.get('price') || '1500'),
      status: params.get('status') || 'PENDING_OWNER_APPROVAL',
      createdAt: Date.now(),
      acceptedAt: Date.now(),
      paidAt: null,
      invoiceNo: null,
      holdingFeeDeducted: 0,
      netRefundAmount: 0
    };
    orders.unshift(existing);
    saveOrders(orders);
  }

  if (existing) {
    activeOrderId = existing.id;
    window.history.replaceState({}, document.title, window.location.pathname + '#order-portal');
    switchPortalTab('customer');
    renderCustomerOrder(existing.id);
  }
}

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  const invModal = document.getElementById('invoice-modal');
  if (invModal && !invModal.hidden) invModal.hidden = true;
  else if (ownerAuthModal && !ownerAuthModal.hidden) ownerAuthModal.hidden = true;
  else if (chatPanel && !chatPanel.hidden) closeChat(true);
  else if (menu && menu.getAttribute('aria-expanded') === 'true') closeMenu(true);
});

document.addEventListener('click', event => {
  if (chatPanel && !chatPanel.hidden && !chatPanel.contains(event.target) && !chatToggle.contains(event.target)) {
    closeChat();
  }
});

// Initialize Portal on Page Load
renderCustomerOrder();
renderOwnerDashboard();
renderEmailLogs();
handleIncomingEmailLinks();
