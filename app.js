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
        estimateSummary: inquiry.estimateSummary,
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

const estimateTiers = {
  phone: [
    {
      id: 'charging-port', label: 'Loose port or unreliable charging', price: '₱800–₱1,800', time: '1–3 working days',
      context: 'Choose this if charging cuts out when the plug moves, the cable no longer seats fully, or a charger that works with another phone fails with yours.',
      includes: ['Check how the charger seats and whether the connection drops.', 'Inspect the port and nearby connections to identify the repair.', 'Verify charging on the repaired device before handover.']
    },
    {
      id: 'no-power', label: 'No power or repeated restarts', price: '₱1,200–₱2,500+', time: '2–5 working days',
      context: 'The phone stays unresponsive, stops at the startup logo, or switches off soon after reaching the home screen. Mention whether it vibrates or rings.',
      includes: ['Check the reported startup or restart behavior.', 'Trace the power fault and identify any parts needed.', 'Retest startup and the original symptom after approved work.']
    },
    {
      id: 'display-touch', label: 'Blank display, lines, or missed touches', price: '₱300 diagnostic', time: '1–2 working days for diagnosis',
      assessmentOnly: true,
      context: 'The phone rings with a black screen, shows lines, or misses taps in one area. Include the exact model and whether the glass is cracked.',
      includes: ['Compare display output with touch response.', 'Inspect the screen connection and check the compatible part if needed.', 'Explain the repair options and retest the affected areas after approved work.']
    },
    {
      id: 'battery-runtime', label: 'Battery drains quickly or charge level jumps', price: '₱300 diagnostic', time: '1–2 working days for diagnosis',
      assessmentOnly: true,
      context: 'The phone charges but its percentage falls sharply while idle, or it shuts down while still showing charge. Tell us when this started.',
      includes: ['Review the charging history and reported runtime.', 'Check battery behavior and the power connection.', 'Quote any compatible replacement or further board work indicated by the checks.']
    },
    {
      id: 'call-audio', label: 'Quiet earpiece, silent speaker, or microphone fault', price: '₱800–₱1,800', time: '1–3 working days',
      context: 'Calls may sound faint at your ear while speakerphone works, or callers may hear silence even though you hear them. Tell us which direction of audio is affected.',
      includes: ['Compare audio playback, call output, and microphone input.', 'Inspect the affected opening, module, and connection.', 'Check the original audio symptom again after approved work.']
    },
    {
      id: 'side-buttons', label: 'Stuck power button or unresponsive volume keys', price: '₱800–₱1,800', time: '1–3 working days',
      context: 'A side button feels loose, stays pressed, or works only after several tries. Note which key is affected and whether it still clicks.',
      includes: ['Check the response and mechanical travel of each affected key.', 'Inspect the button assembly and its internal connection.', 'Retest repeated presses after the approved repair.']
    },
    {
      id: 'other', label: 'Other — please specify', price: 'Custom repair quote', time: 'After assessment',
      context: 'Describe what you see or hear, which phone model you have, and when the problem happens. Mention any recent drop, spill, or previous repair if relevant.',
      includes: ['Review your phone model and the symptom you describe.', 'Agree on the checks needed before arranging handover.', 'Explain the proposed work, price, and timing before you decide.']
    }
  ],
  board: [
    {
      id: 'port-pad', label: 'Damaged port or lifted solder pad', price: '₱800–₱1,600', time: '2–4 working days',
      context: 'Choose this for a specific board connector that has come loose or detached, especially if a copper pad came away with it.',
      includes: ['Inspect the connector, anchor points, and attached pads.', 'Identify the joint or pad that needs micro-soldering.', 'Check continuity and the connector function after repair.']
    },
    {
      id: 'trace-smd', label: 'Broken trace or surface-mount fault', price: '₱1,200–₱2,500+', time: '3–7 working days',
      context: 'A scratch crosses a copper path, a small component is missing, or one board function stopped working after impact. Describe where the damage sits.',
      includes: ['Trace the affected circuit and inspect nearby components.', 'Quote the trace restoration or component work identified.', 'Check the repaired path and retest the reported fault.']
    },
    {
      id: 'power-path', label: 'Board will not power up or trips the supply', price: '₱1,200–₱2,500+', time: '3–7 working days',
      context: 'The board shows no signs of startup or its power source cuts out when connected. Note the board marking and how it was normally powered.',
      includes: ['Review the board revision and its normal power input.', 'Trace the affected supply path and locate suspect components.', 'Quote the component repair and check startup after approved work.']
    },
    {
      id: 'flex-socket', label: 'Broken ribbon-cable socket or latch', price: '₱800–₱2,000', time: '2–5 working days',
      context: 'A flat ribbon cable no longer stays in its socket, or a connected screen, keyboard, or camera drops out when the cable moves.',
      includes: ['Inspect the connector latch, pin alignment, and cable end.', 'Check the socket footprint and compatible replacement.', 'Test the repaired connection with the matching cable or module when available.']
    },
    {
      id: 'spill-corrosion', label: 'Corrosion or residue after a spill', price: '₱300 diagnostic', time: '1–2 working days for diagnosis',
      assessmentOnly: true,
      context: 'One or more functions stopped working after liquid exposure, or you can see residue at a connector. Include the board type and which functions changed.',
      includes: ['Inspect the visible residue and surrounding contacts.', 'Identify affected circuit areas and assess whether local repair is feasible.', 'Explain the findings and quote the recoverable work.']
    },
    {
      id: 'prior-rework', label: 'Board fault after a previous solder repair', price: '₱1,200–₱2,500+', time: '3–7 working days',
      context: 'A port or chip was already replaced, but the original fault remains or an adjacent function stopped working. Share what was changed.',
      includes: ['Inspect the previous rework area and nearby parts.', 'Check for damaged pads, unintended bridges, or an open connection.', 'Separate any rework needed from further diagnosis of the original fault.']
    },
    {
      id: 'other', label: 'Other — please specify', price: 'Custom repair quote', time: 'After assessment',
      context: 'Identify the board or device, the function that has failed, and anything visible near the fault. Include a board revision or connector marking if you have it.',
      includes: ['Review the board details and affected function.', 'Identify an appropriate bench check for the reported symptom.', 'Quote the repair scope once the affected area is understood.']
    }
  ],
  peripherals: [
    {
      id: 'keyboard-switch', label: 'Keyboard misses or repeats a key', price: '₱350–₱900', time: '1–3 working days',
      context: 'One key types twice, fails to register, or needs a harder press than the surrounding keys. List the key names and keyboard model.',
      includes: ['Identify which key misses, repeats, or sticks.', 'Inspect the switch, socket, and associated solder joints.', 'Repeat the affected keystrokes to check the repair.']
    },
    {
      id: 'mouse-click', label: 'Mouse double-clicks or skips scroll steps', price: '₱350–₱750', time: '1–2 working days',
      context: 'One press opens two items, a drag releases early, or the page jumps backward as you roll the wheel. Tell us which button or direction is affected.',
      includes: ['Reproduce the double-click or skipped scroll input.', 'Inspect the affected switch or wheel encoder.', 'Retest repeated clicks or scrolling after the repair.']
    },
    {
      id: 'cable', label: 'Intermittent cable or connection', price: '₱400–₱1,000', time: '1–3 working days',
      context: 'The keyboard or mouse disconnects when the cable bends near the plug or housing. Mention whether the cable is fixed or detachable.',
      includes: ['Check where the device loses its connection.', 'Inspect the cable, plug, and internal connector.', 'Verify a stable connection during normal movement.']
    },
    {
      id: 'key-row', label: 'Several keys in one row or column fail', price: '₱500–₱1,000', time: '1–3 working days',
      context: 'A group of keys stops registering together while the rest of the keyboard still works. List the affected keys in their physical order.',
      includes: ['Map which keys register and which fail together.', 'Inspect the matrix path, sockets, and shared connections.', 'Check the full affected row or column after approved work.']
    },
    {
      id: 'mouse-tracking', label: 'Cursor skips or stops moving', price: '₱350–₱900', time: '1–3 working days',
      context: 'Clicks and scrolling still work, but the pointer jumps or stops on a surface the mouse used to track. Mention whether the fault is constant.',
      includes: ['Compare pointer movement with button and wheel response.', 'Inspect the sensor opening, lens alignment, and connection.', 'Retest tracking across the affected directions after approved work.']
    },
    {
      id: 'other', label: 'Other — please specify', price: 'Custom repair quote', time: 'After assessment',
      context: 'Tell us whether it is a keyboard or mouse, how it connects, and exactly which action fails. A repeatable example helps the bench check the same input.',
      includes: ['Review the model and input that is giving trouble.', 'Agree on how the shop can reproduce the behavior.', 'Quote the affected part or connection if a repair is feasible.']
    }
  ],
  pcb: [
    {
      id: 'layout-routing', label: 'PCB layout and routing', price: '₱1,500–₱3,000', time: '3–7 working days',
      context: 'You have a schematic or agreed circuit and need footprints placed and routed within a board outline. Include mounting holes and connector positions.',
      includes: ['Review the schematic, board outline, and connector positions.', 'Agree on the routing scope and required files.', 'Check the layout against the agreed constraints before handoff.']
    },
    {
      id: 'prototype-assembly', label: 'Prototype board assembly', price: '₱2,000–₱5,000+', time: '5–10 working days',
      context: 'Your layout is ready or the bare PCBs have arrived, and you need components populated. Include board quantity, parts list, and assembly files.',
      includes: ['Check the bare board and parts list for assembly readiness.', 'Assemble the components in the agreed scope.', 'Inspect the joints and run the checks agreed for the prototype.']
    },
    {
      id: 'layout-revision', label: 'Revise an existing PCB layout', price: '₱1,500–₱3,000', time: '3–7 working days',
      context: 'Your first revision needs a moved connector, a revised mounting hole, or a changed component footprint. Share the editable layout and the requested changes.',
      includes: ['Compare the requested change with the current layout.', 'Revise the affected placement and routing within the agreed scope.', 'Review the updated board files and identify the revision at handoff.']
    },
    {
      id: 'footprint-review', label: 'Footprint and connector fit review', price: '₱500/hour', time: '3–5 working days',
      context: 'Before ordering boards, you want to check a connector orientation, pad spacing, or package against the actual part. Send the layout and part numbers.',
      includes: ['Match the selected parts to their footprint dimensions.', 'Review pin numbering, orientation, and connector clearances.', 'Return the fit findings and identify any separately scoped layout changes.']
    },
    {
      id: 'other', label: 'Other — please specify', price: 'Custom project quote', time: 'After brief review',
      context: 'Describe what the board should do, what files or hardware already exist, and the output you need next. Include the board quantity and your target date.',
      includes: ['Review the current design stage and available files.', 'Agree on the deliverables and any fabrication or sourcing dependencies.', 'Provide a scoped quote and a proposed handoff schedule.']
    }
  ],
  diagnostic: [
    {
      id: 'power-assessment', label: 'Phone or board fault assessment', price: '₱300', time: '1–2 working days',
      context: 'Pick this when a phone or board will not start and you want the fault assessed before choosing a repair. Include the model or board marking.',
      includes: ['Document the model and symptoms at intake.', 'Inspect the affected area and identify the next diagnostic or repair step.', 'Explain the findings and quote any proposed repair.']
    },
    {
      id: 'input-assessment', label: 'Keyboard or mouse fault assessment', price: '₱300', time: '1–2 working days',
      context: 'Choose this if you know an input is unreliable but cannot tell whether the switch, connector, or board is responsible.',
      includes: ['Record the affected keys, buttons, wheel, or connection.', 'Check the inputs against the symptoms you report.', 'Explain the findings and quote any proposed repair.']
    },
    {
      id: 'intermittent-assessment', label: 'Fault that only appears sometimes', price: '₱300', time: '1–2 working days for initial assessment',
      context: 'The device works at first, then fails after a particular action or period of use. Describe how often it happens and the shortest way to repeat it.',
      includes: ['Record the conditions that trigger the fault.', 'Attempt to reproduce it and explain what the initial check shows.', 'Agree on any further observation or repair scope if the fault remains intermittent.']
    },
    {
      id: 'other', label: 'Other — please specify', price: '₱300 for bench diagnosis', time: '1–2 working days for initial assessment',
      context: 'List the device or board, what it normally does, and what has changed. Tell us which question you want the assessment to answer.',
      includes: ['Record your device and the question you want checked.', 'Assess the reported behavior and explain the findings.', 'Recommend the next step and quote repair work where feasible.']
    }
  ]
};

function setupEstimator(onLock) {
  const tool = document.querySelector('#estimate-tool');
  if (!tool) return;
  const category = tool.querySelector('#estimate-category');
  const tier = tool.querySelector('#estimate-tier');
  const context = tool.querySelector('#estimate-context');
  const otherField = tool.querySelector('#estimate-other-field');
  const other = tool.querySelector('#estimate-other');
  const otherError = tool.querySelector('#estimate-other-error');
  const lockButton = tool.querySelector('#lock-estimate');
  const otherDrafts = new Map();
  const inclusions = tool.querySelector('#estimate-includes');
  const announcement = tool.querySelector('#estimate-announcement');

  for (const option of form.elements.servicePackage.options) {
    if (estimateTiers[option.dataset.key]) category.add(new Option(option.value, option.dataset.key));
  }

  function currentEstimate() {
    const key = category.value;
    const selected = estimateTiers[key][tier.selectedIndex];
    let terms = 'Allow this bench time after approval and once parts are available. Courier transit is separate.';
    if (selected.assessmentOnly || key === 'diagnostic') {
      terms = 'The assessment window starts when the shop receives your device. The ₱300 fee counts toward an approved repair. Parts, repair costs, and the repair date are confirmed after diagnosis.';
    } else if (key === 'pcb' && selected.id === 'other') {
      terms = 'We’ll review your files and agree on deliverables. Separately scoped PCB work is ₱500 per hour.';
    } else if (selected.id === 'other') {
      terms = 'We’ll review your description first. If the device needs a bench diagnostic, the ₱300 fee goes toward the final repair bill when you proceed.';
    } else if (key === 'pcb') {
      terms = 'The bench window starts after approval and receipt of the required files, boards, and parts. Fabrication and delivery are separate. Separately scoped work is ₱500 per hour.';
    }
    return {category: key, ...selected, terms};
  }

  function clearOtherError() {
    other.removeAttribute('aria-invalid');
    otherError.textContent = '';
  }

  function showEstimate(announce) {
    const estimate = currentEstimate();
    const custom = estimate.id === 'other';
    context.textContent = estimate.context;
    otherField.hidden = !custom;
    other.disabled = !custom;
    other.required = custom;
    other.value = custom ? otherDrafts.get(category.value) || '' : '';
    clearOtherError();
    lockButton.textContent = custom ? 'Add This Issue to My Inquiry' : 'Lock In This Estimate';
    tool.querySelector('#estimate-title').textContent = estimate.label;
    tool.querySelector('#estimate-price').textContent = estimate.price;
    tool.querySelector('#estimate-time').textContent = estimate.time;
    tool.querySelector('#estimate-terms').textContent = estimate.terms;
    inclusions.replaceChildren(...estimate.includes.map(text => {
      const li = document.createElement('li');
      li.textContent = text;
      return li;
    }));
    if (announce) announcement.textContent = estimate.label + '. ' + estimate.context + ' ' + estimate.price + '. ' + estimate.time + '.';
  }

  function showTiers(announce) {
    tier.replaceChildren(...estimateTiers[category.value].map(item => new Option(item.label, item.id)));
    showEstimate(announce);
  }

  category.addEventListener('change', () => showTiers(true));
  tier.addEventListener('change', () => showEstimate(true));
  other.addEventListener('input', () => {
    otherDrafts.set(category.value, other.value);
    if (other.value.trim()) clearOtherError();
  });
  form.addEventListener('reset', () => {
    otherDrafts.clear();
    other.value = '';
    clearOtherError();
  });
  lockButton.addEventListener('click', event => {
    const description = other.disabled ? '' : other.value.trim();
    if (!other.disabled && !description) {
      event.preventDefault();
      other.setAttribute('aria-invalid', 'true');
      otherError.textContent = 'Describe the symptom or project so the shop can assess it.';
      other.focus();
      return;
    }
    if (!onLock({...currentEstimate(), description})) event.preventDefault();
  });
  showTiers(false);
  tool.hidden = false;
  document.querySelector('#estimate-fallback').hidden = true;
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
  let lockedEstimate = null;
  let autoFilledIssue = null;
  const estimatePanel = document.querySelector('#booking-estimate');

  function clearEstimate() {
    if (autoFilledIssue !== null && fields.issue.value === autoFilledIssue) fields.issue.value = '';
    autoFilledIssue = null;
    lockedEstimate = null;
    fields.estimateSummary.value = '';
    estimatePanel.hidden = true;
  }

  function selectService(key) {
    const option = Array.from(fields.servicePackage.options).find(item => item.dataset.key === key);
    if (!option) return false;
    fields.servicePackage.value = option.value;
    validate(fields.servicePackage);
    return true;
  }

  setupEstimator(estimate => {
    if (sending || !selectService(estimate.category)) return false;
    clearEstimate();
    lockedEstimate = estimate;
    const summary = estimate.label + ' · ' + estimate.price + ' · ' + estimate.time;
    const description = estimate.description ? 'Your description: ' + estimate.description : '';
    fields.estimateSummary.value = ['Planning estimate: ' + summary, description, estimate.terms, 'Included: ' + estimate.includes.join(' ')].filter(Boolean).join('\n');
    document.querySelector('#booking-estimate-summary').textContent = [summary, description].filter(Boolean).join(' — ');
    if (estimate.description && !fields.issue.value.trim()) {
      autoFilledIssue = estimate.description;
      fields.issue.value = autoFilledIssue;
      validate(fields.issue);
    }
    estimatePanel.hidden = false;
    fields.customerName.focus({preventScroll:true});
    return true;
  });
  document.querySelector('#remove-estimate').addEventListener('click', () => {
    clearEstimate();
    fields.servicePackage.focus();
  });
  fields.servicePackage.addEventListener('change', clearEstimate);
  form.addEventListener('reset', clearEstimate);

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
    if (event.target === fields.issue) autoFilledIssue = null;
    if (event.target.getAttribute('aria-invalid') === 'true') validate(event.target);
    if (event.target.name === 'preference') syncHandover();
    if (status.dataset.state === 'success') showStatus(status, '');
  });
  document.querySelectorAll('[data-service], [data-preference]').forEach(link => {
    link.addEventListener('click', () => {
      if (sending) return;
      if (link.dataset.service) {
        clearEstimate();
        selectService(link.dataset.service);
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

  function currentInquiry() {
    const service = fields.servicePackage.selectedOptions[0];
    if (lockedEstimate && lockedEstimate.category !== service.dataset.key) clearEstimate();
    const inquiry = {
      id: draftReference,
      createdAt: Date.now(),
      customerName: fields.customerName.value.trim(),
      customerEmail: fields.customerEmail.value.trim(),
      mobile: fields.mobile.value.trim(),
      serviceName: service.value,
      device: fields.device.value.trim(),
      issue: fields.issue.value.trim(),
      estimateSummary: lockedEstimate ? fields.estimateSummary.value : '',
      preference: fields.preference.value,
      amount: service.dataset.price
        ? (service.dataset.key === 'diagnostic' ? '' : 'From ') + '₱' + Number(service.dataset.price).toLocaleString('en-PH')
        : 'Quoted after assessment'
    };
    if (lockedEstimate) inquiry.amount = lockedEstimate.price;
    inquiry.details = [
      'Reference: ' + inquiry.id,
      'Customer: ' + inquiry.customerName + ' (' + inquiry.customerEmail + ' / ' + inquiry.mobile + ')',
      'Service: ' + inquiry.serviceName + ' · ' + inquiry.amount,
      'Device / project: ' + inquiry.device,
      'Issue: ' + inquiry.issue,
      inquiry.estimateSummary,
      'Handover: ' + (inquiry.preference === 'local' ? 'Local drop-off' : 'Mail-in')
    ].filter(Boolean).join('\n');
    return inquiry;
  }

  // The direct-email fallback should reflect edits made after a failed send.
  emailLink.addEventListener('click', () => {
    if (draftReference) emailLink.href = contactLink(draftReference, currentInquiry().details);
  });

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
    const inquiry = currentInquiry();

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
