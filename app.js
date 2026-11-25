'use strict';

const OWNER_EMAIL = 'giancastillo116@gmail.com';
const EMAILJS = {
  url: 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js',
  publicKey: 'T4ns6nIGTXCULdidV',
  service: 'service_f6v7jiz',
  template: 'template_twgq1qn'
};
const REFERENCE_PREFIX = 'circuit_senshi_reference_';
const LEGACY_ORDERS = 'circuit_senshi_orders_v1';
const REQUEST_TIMEOUT = 12000;
const menu = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
const chatToggle = document.querySelector('#chat-toggle');
const chatPanel = document.querySelector('#chat-panel');
const form = document.querySelector('#repair-form');
const lookupForm = document.querySelector('#lookup-form');

function closeMenu(restoreFocus = false) {
  navigation.classList.remove('is-open');
  menu.setAttribute('aria-expanded', 'false');
  if (restoreFocus) menu.focus();
}

function closeChat(restoreFocus = false) {
  chatPanel.hidden = true;
  chatToggle.setAttribute('aria-expanded', 'false');
  if (restoreFocus) chatToggle.focus();
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
  matchMedia('(min-width: 62.001rem)').addEventListener('change', event => {
    if (event.matches) closeMenu();
  });
}

if (chatPanel && chatToggle) {
  chatToggle.hidden = false;
  chatToggle.addEventListener('click', () => {
    if (!chatPanel.hidden) {
      closeChat(true);
      return;
    }
    chatPanel.hidden = false;
    chatToggle.setAttribute('aria-expanded', 'true');
    document.querySelector('#close-chat').focus();
  });
  document.querySelector('#close-chat').addEventListener('click', () => closeChat(true));
  document.querySelector('#chat-inquiry').addEventListener('click', () => {
    closeChat();
    form?.elements.customerName.focus({ preventScroll: true });
  });
  document.addEventListener('click', event => {
    if (!chatPanel.hidden && !chatPanel.contains(event.target) && !chatToggle.contains(event.target)) closeChat();
  });
}

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (chatPanel && !chatPanel.hidden) closeChat(true);
  else if (menu?.getAttribute('aria-expanded') === 'true') closeMenu(true);
});

function showStatus(element, message, state = '') {
  element.textContent = message;
  element.dataset.state = state;
}

function contactLink(id, body = '') {
  return 'mailto:' + OWNER_EMAIL + '?subject=' + encodeURIComponent('Circuit Senshi inquiry ' + id) +
    (body ? '&body=' + encodeURIComponent(body) : '');
}

function referenceURL(id) {
  const address = new URL(window.location.href);
  address.search = '';
  address.searchParams.set('order', id);
  address.hash = 'order-portal';
  return address.href;
}

function newReference() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return 'CS-' + Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function saveReference(inquiry) {
  const { id, serviceName, createdAt } = inquiry;
  try {
    localStorage.setItem(REFERENCE_PREFIX + id, JSON.stringify({ id, serviceName, createdAt }));
  } catch {
    // Private browsing and a full storage quota must still allow inquiries.
  }
}

function findReference(id) {
  try {
    const recent = JSON.parse(localStorage.getItem(REFERENCE_PREFIX + id));
    if (recent?.id === id) return recent;
    const earlier = JSON.parse(localStorage.getItem(LEGACY_ORDERS) || '[]');
    if (Array.isArray(earlier)) return earlier.find(order => order?.id === id);
  } catch {
    // A damaged or unavailable browser record can still be followed up by email.
  }
  return null;
}

function showReference(value, fromEmail = false) {
  const status = document.querySelector('#lookup-status');
  const link = document.querySelector('#reference-contact');
  const id = value.trim().toUpperCase();
  if (!/^CS-(?:\d{4}|[A-F0-9]{12})$/.test(id)) {
    showStatus(status, 'Enter the full CS- reference from your inquiry.', 'error');
    link.href = 'mailto:' + OWNER_EMAIL;
    link.textContent = 'Email about an inquiry';
    return;
  }

  const record = findReference(id);
  let message;
  if (record) {
    const service = typeof record.serviceName === 'string' ? record.serviceName : 'Service inquiry';
    message = id + ' · ' + service + '. This reference is saved on this device. Ask the shop for the latest update.';
  } else if (fromEmail) {
    message = 'Your email links to ' + id + '. Contact the shop with this reference for an update.';
  } else {
    message = 'No inquiry matches ' + id + ' in this browser. The shop can look it up for you.';
  }
  showStatus(status, message, record || fromEmail ? 'success' : '');
  link.href = contactLink(id);
  link.textContent = 'Ask about, change or cancel ' + id;
}

if (lookupForm) {
  lookupForm.hidden = false;
  lookupForm.addEventListener('submit', event => {
    event.preventDefault();
    showReference(lookupForm.elements.order.value);
  });
  const incoming = new URLSearchParams(window.location.search);
  if (incoming.has('order')) {
    const id = incoming.get('order').trim().toUpperCase();
    // Older email links included personal details. Discard the query, including its claimed booking state.
    window.history.replaceState(null, '', window.location.pathname + '#order-portal');
    if (/^CS-(?:\d{4}|[A-F0-9]{12})$/.test(id)) lookupForm.elements.order.value = id;
    showReference(id, true);
  }
}

let sdkPromise;
let previousEmailAt = 0;

function loadEmailSDK() {
  if (window.emailjs) return Promise.resolve(window.emailjs);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => finish(false), REQUEST_TIMEOUT);
    function finish(loaded) {
      clearTimeout(timer);
      script.onload = script.onerror = null;
      if (loaded && window.emailjs) {
        resolve(window.emailjs);
      } else {
        script.remove();
        sdkPromise = null;
        reject(new Error('Email service unavailable.'));
      }
    }
    script.async = true;
    script.src = EMAILJS.url;
    script.onload = () => finish(true);
    script.onerror = () => finish(false);
    document.head.append(script);
  });
  return sdkPromise;
}

async function sendEmail(inquiry, toCustomer) {
  let timer;
  try {
    const sdk = await loadEmailSDK();
    const delay = 1050 - (Date.now() - previousEmailAt);
    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
    previousEmailAt = Date.now();
    const subject = 'Service quote request [' + inquiry.id + ']';
    const payload = {
      to_email: toCustomer ? inquiry.customerEmail : OWNER_EMAIL,
      to_name: toCustomer ? inquiry.customerName : 'Circuit Senshi Tech Solutions',
      name: toCustomer ? 'Circuit Senshi Tech Solutions' : inquiry.customerName,
      email: toCustomer ? OWNER_EMAIL : inquiry.customerEmail,
      subject: toCustomer ? subject : '[OWNER] ' + subject,
      order_id: inquiry.id,
      service_name: inquiry.serviceName + ' (' + inquiry.device + ')',
      amount: inquiry.amount,
      status: 'PENDING OWNER APPROVAL',
      message_body: (toCustomer
        ? 'Your inquiry has been submitted. The shop will reply to discuss the assessment, quote and timing.'
        : 'New inquiry. Contact the customer to confirm scope, quote and handover.') +
        '\n\n' + inquiry.details,
      action_link: referenceURL(inquiry.id)
    };
    const send = sdk.send(EMAILJS.service, EMAILJS.template, payload, { publicKey: EMAILJS.publicKey });
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Email response timed out.')), REQUEST_TIMEOUT);
    });
    const response = await Promise.race([send, timeout]);
    return response?.status >= 200 && response.status < 300;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function sendFormspree(inquiry) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const response = await fetch(form.action, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        _subject: '[Circuit Senshi Owner Copy] Service quote request (' + inquiry.id + ')',
        _gotcha: '',
        orderReference: inquiry.id,
        status: 'PENDING_OWNER_APPROVAL',
        invoiceNumber: 'Pending quote',
        customerName: inquiry.customerName,
        customerEmail: inquiry.customerEmail,
        email: inquiry.customerEmail,
        mobile: inquiry.mobile,
        service: inquiry.serviceName,
        device: inquiry.device,
        issue: inquiry.issue,
        preference: inquiry.preference,
        amount: inquiry.amount,
        details: inquiry.details,
        portalLink: referenceURL(inquiry.id)
      })
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function initInquiry() {
  const status = document.querySelector('#form-status');
  const submit = form.querySelector('[type="submit"]');
  const spinner = submit.querySelector('.submit-spinner');
  const submitLabel = document.querySelector('#submit-label');
  const emailLink = document.querySelector('#form-email');
  const fields = form.elements;
  const messages = {
    customerName: 'Enter your name.',
    customerEmail: 'Enter a valid email address.',
    mobile: 'Enter a mobile number with 7–15 digits.',
    servicePackage: 'Choose a service.',
    device: 'Enter a device model or PCB project.',
    issue: 'Tell us about your device or project.'
  };
  let sending = false;
  let draftReference = '';

  function validate(field) {
    const value = field.value.trim();
    let invalid = !value || !field.validity.valid;
    if (field.name === 'customerEmail') invalid ||= !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    if (field.name === 'mobile') {
      const digits = value.replace(/\D/g, '');
      invalid ||= !/^\+?[\d\s().-]+$/.test(value) || digits.length < 7 || digits.length > 15;
    }
    document.getElementById(field.getAttribute('aria-describedby')).textContent = invalid ? messages[field.name] : '';
    if (invalid) field.setAttribute('aria-invalid', 'true');
    else field.removeAttribute('aria-invalid');
    return !invalid;
  }

  function syncHandover() {
    document.querySelector('#payment-mail-in').hidden = fields.preference.value !== 'mail-in';
    document.querySelector('#payment-local').hidden = fields.preference.value !== 'local';
  }

  form.addEventListener('input', event => {
    if (event.target.getAttribute('aria-invalid') === 'true') validate(event.target);
    if (event.target.name === 'preference') syncHandover();
    if (status.dataset.state === 'success') showStatus(status, '');
  });
  document.querySelectorAll('[data-service], [data-preference]').forEach(link => {
    link.addEventListener('click', () => {
      if (sending) return;
      if (link.dataset.service) {
        const option = Array.from(fields.servicePackage.options).find(item => item.dataset.key === link.dataset.service);
        if (option) {
          fields.servicePackage.value = option.value;
          validate(fields.servicePackage);
        }
      }
      if (link.dataset.preference) {
        fields.preference.value = link.dataset.preference;
        syncHandover();
      }
    });
  });
  window.addEventListener('pageshow', syncHandover);
  syncHandover();

  function setSending(value) {
    sending = value;
    // Freeze the displayed inputs while their snapshot is in flight.
    for (const field of fields) field.disabled = value;
    form.setAttribute('aria-busy', String(value));
    submitLabel.textContent = value ? 'Sending inquiry…' : 'Request my quote';
    spinner.hidden = !value;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending) return;
    if (fields._gotcha.value) {
      showStatus(status, 'Thank you for your inquiry.');
      return;
    }
    const invalid = Object.keys(messages).map(key => fields[key]).filter(field => !validate(field));
    if (invalid.length) {
      showStatus(status, 'Check the highlighted fields before sending.', 'error');
      invalid[0].focus();
      return;
    }

    draftReference ||= newReference();
    const service = fields.servicePackage.selectedOptions[0];
    const inquiry = {
      id: draftReference,
      createdAt: Date.now(),
      customerName: fields.customerName.value.trim(),
      customerEmail: fields.customerEmail.value.trim(),
      mobile: fields.mobile.value.trim(),
      serviceName: service.value,
      device: fields.device.value.trim(),
      issue: fields.issue.value.trim(),
      preference: fields.preference.value,
      amount: service.dataset.price
        ? (service.dataset.key === 'diagnostic' ? '' : 'From ') + '₱' + Number(service.dataset.price).toLocaleString('en-PH')
        : 'Quoted after assessment'
    };
    inquiry.details = [
      'Reference: ' + inquiry.id,
      'Customer: ' + inquiry.customerName + ' (' + inquiry.customerEmail + ' / ' + inquiry.mobile + ')',
      'Service: ' + inquiry.serviceName + ' · ' + inquiry.amount,
      'Device / project: ' + inquiry.device,
      'Issue: ' + inquiry.issue,
      'Handover: ' + (inquiry.preference === 'local' ? 'Local drop-off' : 'Mail-in')
    ].join('\n');

    setSending(true);
    showStatus(status, 'Sending your inquiry…', 'busy');
    let received = false;
    try {
      const [shopEmail, formspree] = await Promise.all([sendEmail(inquiry, false), sendFormspree(inquiry)]);
      received = shopEmail || formspree;
      if (!received) {
        emailLink.href = contactLink(inquiry.id, inquiry.details);
        showStatus(status, 'We couldn’t confirm delivery. Your details are still here. Retry or email the shop with reference ' + inquiry.id + '.', 'error');
        return;
      }

      const confirmation = Boolean(window.emailjs) && await sendEmail(inquiry, true);
      saveReference(inquiry);
      if (lookupForm) lookupForm.elements.order.value = inquiry.id;
      form.reset();
      syncHandover();
      emailLink.href = 'mailto:' + OWNER_EMAIL;
      draftReference = '';
      const next = confirmation
        ? 'Your email confirmation is on its way.'
        : 'Save this reference. We couldn’t confirm your email copy.';
      showStatus(status, 'Inquiry sent to the shop. Your reference is ' + inquiry.id + '. ' + next, 'success');
    } finally {
      setSending(false);
      if (!received || document.activeElement === document.body) status.focus({ preventScroll: true });
    }
  });
  // Keep the native POST and browser validation available when JavaScript is off.
  form.noValidate = true;
}

if (form) initInquiry();

// Only animate items that approach from below. Direct links and restored pages
// show the content already in view immediately.
if ('IntersectionObserver' in window) {
  const motionAllowed = matchMedia('(prefers-reduced-motion: no-preference)');
  const approaching = new WeakSet();
  const arrivals = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const item = entry.target;
      if (!entry.isIntersecting && entry.boundingClientRect.top > 0) {
        approaching.add(item);
        continue;
      }
      arrivals.unobserve(item);
      if (entry.isIntersecting && approaching.has(item) && motionAllowed.matches && !item.matches(':focus-within')) {
        item.classList.add('is-arriving');
      }
    }
  }, { rootMargin: '0px 0px 8px 0px' });

  document.querySelectorAll('.section-heading, .service-card, .local-path, .portfolio-grid > article')
    .forEach(item => arrivals.observe(item));

  function finishArrival(event) {
    if (event.animationName === 'section-arrive') event.target.classList.remove('is-arriving');
  }
  document.addEventListener('animationend', finishArrival);
  document.addEventListener('animationcancel', finishArrival);
}
