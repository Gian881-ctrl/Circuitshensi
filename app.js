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

/* ================= EMAIL, FORMSPREE & OWNER PIN CONFIG ================= */
const AUTOMATION_CONFIG = {
  FORMSPREE_ENDPOINT: 'https://formspree.io/f/xwlpvlgd',
  OWNER_EMAIL: 'giancastlo117@gmail.com',
  OWNER_PASSCODE: '1012', // Secret Owner PIN required to open the Admin Panel
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

/* ================= OWNER AUTHENTICATION LOCK ================= */
const OWNER_AUTH_KEY = 'cs_owner_authenticated_session';

function isOwnerAuthenticated() {
  return sessionStorage.getItem(OWNER_AUTH_KEY) === 'true';
}

function requireOwnerAuth() {
  if (isOwnerAuthenticated()) return true;
  const entered = prompt('🔒 Owner Access Only — Enter Circuit Senshi Owner Passcode:');
  if (entered === null) return false;
  if (entered.trim() === AUTOMATION_CONFIG.OWNER_PASSCODE) {
    sessionStorage.setItem(OWNER_AUTH_KEY, 'true');
    showToast('🔓 Owner Admin Panel unlocked.');
    return true;
  }
  alert('❌ Access Denied: Incorrect Owner Passcode. Only the shop owner can access the Admin Control Panel.');
  return false;
}

window.lockOwnerPanel = function() {
  sessionStorage.removeItem(OWNER_AUTH_KEY);
  switchPortalTab('customer');
  showToast('🔒 Owner Admin Panel locked.');
};

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
  showToast._timer = setTimeout(() => {
    toast.hidden = true;
  }, 6000);
}

function buildActionUrl(order, actionType) {
  const baseUrl = window.location.origin + window.location.pathname;
  const payload = encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(order)))));
  return `${baseUrl}?order=${encodeURIComponent(order.id)}&action=${encodeURIComponent(actionType)}&data=${payload}#order-portal`;
}

/* Sends real Gmail messages ONLY when sendToCustomer / sendToOwner is true */
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

  const ownerAcceptUrl = buildActionUrl(order, 'owner-accept');
  const ownerCancelUrl = buildActionUrl(order, 'owner-cancel');
  const customerPortalUrl = buildActionUrl(order, 'customer-view');
  const customerCancelUrl = buildActionUrl(order, 'customer-cancel');

  logs.unshift({
    time: timestamp,
    subject: eventTitle,
    toCustomer: sendToCustomer ? `${order.customerName} <${order.customerEmail}>` : 'Portal Updated (No extra email)',
    toOwner: sendToOwner ? `Owner <${AUTOMATION_CONFIG.OWNER_EMAIL}>` : 'Portal Updated',
    customerBody: customerMessage,
    ownerBody: ownerMessage
  });
  localStorage.setItem(EMAIL_LOG_KEY, JSON.stringify(logs.slice(0, 20)));
  renderEmailLogs();

  // Send via EmailJS ONLY for the 2 allowed emails: (1) Confirmation Request, (2) Official Invoice Receipt
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
          service_name: order.serviceName,
          amount: `₱${order.price.toFixed(2)}`,
          status: order.status.replaceAll('_', ' '),
          message_body: `${customerMessage}\n\nCancel Booking Link:\n${customerCancelUrl}`,
          action_link: customerPortalUrl
        }
      );
    } catch (err) {
      console.warn('EmailJS customer send warning:', err);
    }
  }

  // Send Owner Copy via Formspree (to avoid duplicate EmailJS emails in Owner inbox)
  if (sendToOwner) {
    try {
      await fetch(AUTOMATION_CONFIG.FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          _subject: `[Circuit Senshi] ${eventTitle} (${order.id})`,
          orderReference: order.id,
          status: order.status,
          invoiceNumber: order.invoiceNo || 'N/A',
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          mobile: order.mobile,
          service: order.serviceName,
          amount: `₱${order.price.toFixed(2)}`,
          details: ownerMessage,
          CLICK_TO_ACCEPT_REPAIR: ownerAcceptUrl,
          CLICK_TO_CANCEL_REPAIR: ownerCancelUrl
        })
      });
    } catch (err) {
      console.warn('Formspree background sync notice:', err);
    }
  }
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
      <small>${item.time} • Customer: <strong>${item.toCustomer}</strong> \vert{} Owner: <strong>${item.toOwner}</strong></small>
      <strong>${item.subject}</strong>
      <p style="margin-top:4px;color:var(--muted);"><strong>Customer Details:</strong> ${item.customerBody}</p>
      <p style="margin-top:2px;color:var(--muted);"><strong>Owner Details:</strong> ${item.ownerBody}</p>
    </div>
  `).join('');
}

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

// STAGE 1: Customer Submits Service Confirmation Request -> EMAIL #1 SENT
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

  // ONLY EMAIL #1: Confirmation Request Form sent to Customer & Owner
  await dispatchAutomatedEmails({
    eventTitle: `Confirmation Request of Service Order [${newOrder.id}]`,
    order: newOrder,
    customerMessage:
      `Hi ${newOrder.customerName},\n\n` +
      `Here is your Service Confirmation Request copy:\n` +
      `• Device / Project: ${newOrder.device} (${newOrder.preference})\n` +
      `• Issue Description: ${newOrder.issue}\n` +
      `• Estimated Rate: ₱${newOrder.price.toFixed(2)}\n\n` +
      `Once the shop owner accepts your request, you can pay online via GCash, BDO/BPI Bank, or Maya in the Order Portal (Ref: ${newOrder.id}).\n` +
      `PolicyHere is why both issues happened when your friend tested the site:

1. **Why your friend could access the Admin Panel:** The yellow notice box in the Customer View had a direct shortcut button to the Owner Panel, and the **🛠️ Owner Admin Control Panel** tab did not have a password lock. Because of that, your friend was able to switch to the Owner tab and click **Accept Repair** himself.
2. **Why two emails arrived at 8:33 PM:** In your screenshot, `Confirmation Request of Service Order [CS-2728]` was sent when he submitted the form, and `Repair Accepted — Online Payment Link Sent [CS-2728]` was sent right after because he clicked the **Accept Repair** button in the Admin Panel[cite: 14].

You only need to update **`app.js`**[cite: 2, 5] to fix both problems. In the updated code below:
* **Owner Admin PIN Lock (`1012`):** The shortcut button inside the customer's banner is removed, and clicking **🛠️ Owner Admin Control Panel** now requires your **Owner PIN (`1012`)**. Friends and customers cannot open it or accept their own repairs.
* **Only 2 Emails Sent (Request Form + Paid Invoice Receipt):** It now sends **only** the initial **Confirmation Request Form** email when a customer books, and the **Official Invoice Receipt** email after they pay (to both the customer and you).

<Steps>

<Step subtitle="1 min" title="Replace app.js in GitHub">
Open `app.js` in your `Circuitshensi` GitHub repository[cite: 2, 5], replace all existing code with the updated script below, and click **Commit changes**:
