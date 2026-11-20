import React from 'react';
import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react';
import { Button, Card } from './ui';

const DOCUMENTS = {
  privacy: {
    title: 'Privacy Policy',
    intro: 'This policy explains what MEDIVEU ERP processes when you use the app and how store access is separated. Use of the app involves handling account and business information described below.',
    sections: [
      ['Account and authentication', 'Accounts are created and signed in with Firebase Authentication using your email and password. We use your Firebase account identifier and available account details to establish your session, associate your membership with a store, and provide password-reset and account services. Keep your sign-in credentials private.'],
      ['Store data and access controls', 'Store settings, inventory, invoices, customers, suppliers, and related business records are stored in Firebase Cloud Firestore. Records are organized under a store workspace. Firebase security rules require an active store membership and apply role-based permissions; a member of one store is not granted access to another store merely by creating an account. Owners and managers have broader store-management access. Worker access is limited by role, including access to their own created invoices where applicable. These controls are designed to isolate store data, but no online system can guarantee absolute security.'],
      ['Camera and QR scanning', 'The app requests camera access only when you choose the QR scanner in billing. The camera is used to read a product or medicine code and match it against your current store inventory. Audio is not requested. You can deny or revoke camera permission in your device or browser settings and enter a code manually instead.'],
      ['Offline operation and device storage', 'Firestore may keep a local device cache to support offline reading and queue writes for later synchronization. Avoid using shared devices for sensitive business information, sign out when finished, and protect access to your device.'],
      ['Payments and referrals', 'Subscription checkout and referral attribution use account, plan, order, and payment-verification information. Payment status is verified by the server before a plan is activated or a referral reward is recorded. See Terms & Conditions for plan and referral rules.'],
      ['Your choices and contact', 'You are responsible for the accuracy and lawful handling of information entered into your store. For questions about your account, data, or this policy, contact salauddeen680@gmail.com. Do not send passwords or payment-card details by email.'],
    ],
  },
  terms: {
    title: 'Terms & Conditions',
    intro: 'By accessing MEDIVEU ERP, you agree to these service terms. If you do not agree, do not use the app. These terms summarize the current product behavior and are not a substitute for legal advice.',
    sections: [
      ['Accounts and store access', 'You must provide accurate account information, maintain the security of your credentials, and use only the store workspace you are authorized to access. Store owners control their team invitations and role assignments. Invite codes are for joining an existing store as staff; they are not owner referral codes and do not by themselves authorize access without a valid invitation and account membership.'],
      ['Plans and free trial', 'The Starter trial lasts 7 days from account creation and does not require a card. Current paid options shown in the app are Monthly (₹249 per month) and Yearly (₹2,799 per year). Plan prices, availability, included features, and renewal or expiry conditions may change; the checkout and plan screen presented to you at purchase govern the transaction. The store owner is responsible for selecting and maintaining the appropriate plan.'],
      ['Payments and verification', 'Payments are initiated through the checkout provider. A client-side checkout success message alone does not activate a subscription: the server verifies payment details before changing the plan or recording a qualifying referral reward. If a payment appears to have succeeded but verification is pending or fails, do not pay again; contact support at salauddeen680@gmail.com.'],
      ['Owner referrals and staff invitations', 'Owner referral codes are used to track referrals between store owners and may qualify for rewards only after a qualifying paid subscription is verified. Staff invitation codes are a separate mechanism for joining an existing store; they do not create an owner referral or confer owner privileges. Referral tracking and rewards are subject to validation and the rules shown in the app, and may be changed or withdrawn to prevent abuse.'],
      ['Your store and invoice information', 'You and your store are responsible for the accuracy, legality, completeness, backup, and retention of store, customer, supplier, inventory, tax, and invoice data entered or generated through the app. Review invoices and applicable tax or pharmacy requirements before issuing them. MEDIVEU ERP is a business-management tool, not legal, tax, accounting, or medical advice. Keep independent backups of important records.'],
      ['Availability and acceptable use', 'Use the service only for lawful business purposes and do not attempt to bypass access controls, disrupt the service, or access data without authorization. Features may be updated, interrupted, or discontinued. To the extent permitted by applicable law, the service is provided without a guarantee of uninterrupted or error-free operation.'],
      ['Questions', 'For help with these terms or a payment verification issue, contact salauddeen680@gmail.com. These terms should be reviewed by qualified counsel for the jurisdiction where the service is offered.'],
    ],
  },
};

export default function LegalDocuments({ type = 'privacy', onBack, embedded = false }) {
  const document = DOCUMENTS[type] || DOCUMENTS.privacy;
  return (
    <main className={`min-h-full bg-ink-950 px-4 py-8 sm:px-6 sm:py-12 ${embedded ? '' : 'min-h-dvh'}`}>
      <article className="mx-auto max-w-3xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          {onBack ? <Button variant="ghost" onClick={onBack} aria-label="Return to the previous screen"><ArrowLeft size={16} /> Back</Button> : <span />}
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-sky/20 bg-brand-sky/5 px-3 py-1.5 text-xs font-medium text-brand-sky"><ShieldCheck size={14} aria-hidden="true" /> MEDIVEU ERP · Legal information</span>
        </div>
        <Card className="overflow-hidden p-5 sm:p-9">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl border border-brand-sky/20 bg-brand-sky/10 text-brand-sky"><FileText size={21} aria-hidden="true" /></span>
            <div><p className="text-xs font-semibold uppercase tracking-widest text-brand-sky">MEDIVEU ERP</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-white sm:text-4xl">{document.title}</h1></div>
          </div>
          <p className="mt-6 border-l-2 border-brand-sky/40 pl-4 text-sm leading-7 text-slate-300">{document.intro}</p>
          <div className="mt-8 divide-y divide-white/[0.07]">
            {document.sections.map(([heading, content], index) => (
              <section key={heading} className="py-5 first:pt-0 last:pb-0" aria-labelledby={`legal-section-${index}`}>
                <h2 id={`legal-section-${index}`} className="text-base font-semibold text-white">{heading}</h2>
                <p className="mt-2 text-sm leading-7 text-slate-400">{content}</p>
              </section>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-2 border-t border-white/[0.07] pt-5">
            {type !== 'privacy' && <Button variant="secondary" onClick={() => onBack?.('privacy')}>Privacy Policy</Button>}
            {type !== 'terms' && <Button variant="secondary" onClick={() => onBack?.('terms')}>Terms & Conditions</Button>}
          </div>
        </Card>
      </article>
    </main>
  );
}
