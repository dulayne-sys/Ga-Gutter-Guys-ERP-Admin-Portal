export default function EulaPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold text-white">End User License Agreement (EULA)</h1>
        <p className="mt-3 text-sm text-slate-300">
          Effective Date: February 16, 2026
        </p>

        <section className="mt-8 space-y-4 text-sm leading-6 text-slate-200">
          <p>
            This End User License Agreement ({"\u201CAgreement\u201D"}) governs your use of the GA Gutter Guys
            Operations Portal ({"\u201CService\u201D"}). By accessing or using the Service, you agree to this Agreement.
          </p>

          <h2 className="pt-2 text-lg font-medium text-white">1. License Grant</h2>
          <p>
            GA Gutter Guys grants you a limited, non-exclusive, non-transferable, revocable license to use
            the Service for internal business operations in accordance with this Agreement.
          </p>

          <h2 className="pt-2 text-lg font-medium text-white">2. Restrictions</h2>
          <p>You agree not to reverse engineer, redistribute, resell, or misuse the Service.</p>

          <h2 className="pt-2 text-lg font-medium text-white">3. Account Responsibility</h2>
          <p>
            You are responsible for maintaining account confidentiality and for all activity under your
            account credentials.
          </p>

          <h2 className="pt-2 text-lg font-medium text-white">4. Third-Party Integrations</h2>
          <p>
            The Service may connect to third-party systems, including Intuit QuickBooks. Your use of those
            systems is subject to their own terms and policies.
          </p>

          <h2 className="pt-2 text-lg font-medium text-white">5. Disclaimer</h2>
          <p>
            The Service is provided {"\u201Cas is\u201D"} and {"\u201Cas available\u201D"} without warranties of any kind, to the
            fullest extent permitted by law.
          </p>

          <h2 className="pt-2 text-lg font-medium text-white">6. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, GA Gutter Guys is not liable for indirect, incidental,
            special, or consequential damages arising from your use of the Service.
          </p>

          <h2 className="pt-2 text-lg font-medium text-white">7. Termination</h2>
          <p>
            We may suspend or terminate access to the Service for violation of this Agreement or applicable
            law.
          </p>

          <h2 className="pt-2 text-lg font-medium text-white">8. Contact</h2>
          <p>
            For legal questions regarding this Agreement, contact: support@ga-gutter-guys.com
          </p>
        </section>
      </div>
    </main>
  );
}
