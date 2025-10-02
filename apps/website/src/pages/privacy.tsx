/* eslint-disable react/no-unescaped-entities */
import { NextSeo } from "next-seo";

import { Footer } from "../components/Layout/Footer";
import { Header } from "../components/Layout/Header";
import data from "../data/home.json";
import { HomePageData } from "../types/components";

interface PrivacyProps {
  layoutData: HomePageData;
}

export default function Privacy({ layoutData }: PrivacyProps) {
  return (
    <>
      <NextSeo
        title="Privacy Policy"
        description="Privacy Policy for Recall Foundation"
      />
      <Header node={layoutData.menu || []} />

      <main className="min-h-screen bg-[#0A0E13] text-white">
        <div className="mx-auto max-w-[1140px] px-[35px] py-24 lg:px-0">
          <h1 className="mb-2 text-4xl font-bold lg:text-5xl">
            Privacy Policy
          </h1>
          <p className="mb-8 text-lg text-gray-400">Last Updated April 2025</p>

          <div className="prose prose-invert max-w-none space-y-6">
            <p className="mb-6">
              Recall Foundation ("Recall," "we," or "us") respects the privacy
              of our customers, partners, and other website visitors ("you" or
              "your"). This Privacy Policy describes how we collect, process,
              share, and safeguard personal information that is collected via
              our website (https://recall.network/) ("Website"), other websites
              that reference this Privacy Policy, and when you engage with our
              services generally (collectively "Services").
            </p>

            <p className="mb-6">
              Recall Foundation will be the controller of your personal
              information in accordance with data protection laws of the
              European Economic Area and the United Kingdom. If you have any
              questions or comments about this Privacy Policy, please submit a
              request to data-privacy@recall.foundation.
            </p>

            <p className="mb-8">
              This Privacy Policy does not apply to personal information we
              process as a processor or service provider on behalf of our
              customers when providing services to them. For example, if we
              process your personal information as part of the service we
              provide to our customers, such customer will act as the controller
              and its privacy policy will govern the processing of your personal
              information.
            </p>

            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold">
                1. Personal Information We Collect
              </h2>
              <p className="mb-4">
                We collect the following categories of personal information.
              </p>

              <ul className="mb-4 list-inside list-disc space-y-3">
                <li>
                  <strong>Profile and project information.</strong> This
                  includes your name, username, contact information (including
                  email, phone number, and address), project twitter, and
                  individual telegram.
                </li>

                <li>
                  <strong>Identification information.</strong> If you win an
                  award or are otherwise subject to our Know Your Customer (KYC)
                  checks, we and our third-party verification partners may
                  collect identification information, such as your street
                  address, email address, date of birth, Social Security number,
                  and other government-issued identification.
                </li>

                <li>
                  <strong>Financial account information.</strong> You may choose
                  to connect financial accounts to the Services, such as your
                  bank account or digital wallet ID. If you connect your
                  accounts to the Services, we may collect your online login
                  information, bank account and routing numbers, account
                  balances, wallet ID number, and other related information.
                </li>

                <li>
                  <strong>Wallet addresses.</strong> You may choose to use your
                  wallet address to interact with our Services and other users
                  of our Services.
                </li>

                <li>
                  <strong>Transactions and commercial information.</strong> We
                  collect information about your transactions on the Services,
                  such as public blockchain data, your rewards, payments you
                  send and receive, and any other transactions you make on the
                  Services.
                </li>

                <li>
                  <strong>Communications with us.</strong> We collect the
                  communications that we exchange with you, including when you
                  contact us with questions, feedback, or otherwise.
                </li>

                <li>
                  <strong>Marketing information.</strong> This includes your
                  preferences for receiving communications about our Services,
                  and details about how you engage with our communications.
                </li>

                <li>
                  <strong>Sweepstakes or Contests.</strong> We may collect
                  personal information that you provide for any sweepstakes or
                  contests that we offer, including our hackathons.
                </li>
              </ul>

              <p className="mb-4 font-semibold">Automatic data collection.</p>
              <p className="mb-4">
                We and our service providers may automatically log information
                about you, your computer or mobile device, and your interaction
                over time with our Services, such as:
              </p>

              <ul className="mb-4 list-inside list-disc space-y-2">
                <li>
                  <strong>Device data,</strong> such as your computer's or
                  mobile device's operating system, manufacturer and model,
                  browser type, IP address, unique identifiers, language
                  settings, mobile device carrier, and general location
                  information such as city, state or geographic area; and
                </li>

                <li>
                  <strong>Usage data,</strong> such as pages or screens you
                  viewed, how long you spent on a page, browsing history, and
                  access times, and page clicks, page scrolls, and page element
                  interactions.
                </li>
              </ul>

              <p className="mb-4">
                We may collect this information using cookies and other similar
                technologies. Please see our Cookie section below to learn more
                about how we use cookies.
              </p>

              <p className="mb-4 font-semibold">
                Information Collected from Third Parties
              </p>

              <ul className="mb-4 list-inside list-disc space-y-2">
                <li>
                  <strong>Third-party services and sources.</strong> We may
                  obtain personal information about you from other sources,
                  including through third-party services and applications. For
                  example, if you access our Services through a third-party
                  application, such a third-party login service or a social
                  networking site, we may collect personal information about you
                  from that third-party application that you have made available
                  via your privacy settings.
                </li>

                <li>
                  <strong>Blockchain information.</strong> We may obtain
                  personal information about you through our analysis of
                  blockchain information, such as wallet and smart contract
                  addresses, transaction data and IP addresses.
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold">
                2. How We Use Personal Information
              </h2>
              <p className="mb-4">
                We use personal information for the following purposes:
              </p>

              <ul className="mb-6 list-inside list-disc space-y-4">
                <li>
                  <strong>To operate and deliver our Services.</strong> We will
                  use your personal information to perform our contractual
                  obligations, when it is in our legitimate business interests
                  or based on your consent, including to:
                  <ul className="ml-6 mt-2 list-inside list-disc space-y-1">
                    <li>
                      Provide, operate, maintain, and secure our Services;
                    </li>
                    <li>Provide support assistance and troubleshooting;</li>
                    <li>
                      Allow you to use features and functionality of the
                      Services;
                    </li>
                    <li>
                      Send you updates about administrative matters such as
                      changes to our terms or policies;
                    </li>
                    <li>
                      Facilitate contests, process and deliver entries and
                      rewards; and
                    </li>
                    <li>
                      Provide user support, and respond to your requests,
                      questions and feedback.
                    </li>
                  </ul>
                </li>

                <li>
                  <strong>
                    To improve, monitor, personalize, and protect our Services.
                  </strong>{" "}
                  It is in our legitimate business interests to improve and keep
                  our Services safe, which includes:
                  <ul className="ml-6 mt-2 list-inside list-disc space-y-1">
                    <li>
                      Enriching your user experience and customize your
                      relationship with us;
                    </li>
                    <li>Protecting the security of our Services;</li>
                    <li>
                      Preventing and detecting security threats, fraud or other
                      criminal or malicious activities; and
                    </li>
                    <li>
                      Administering content, promotion, sweepstakes, surveys,
                      voting polls and other Website features.
                    </li>
                  </ul>
                </li>

                <li>
                  <strong>Research and development.</strong> It is in our
                  legitimate business interests to use personal information
                  (including the personal information described in this Privacy
                  Policy and personal information collected on behalf of our
                  customers) to develop, analyze and improve the Services and
                  our business. As part of these activities, we may create or
                  use aggregated, de-identified or other anonymized data from
                  personal information we collect. We anonymize data by removing
                  information that makes the data personally identifiable. We
                  may use this anonymized data and share it with third parties
                  for our lawful business purposes, including to analyze and
                  improve the Services and promote our business.
                </li>

                <li>
                  <strong>Marketing and advertising,</strong> including to send
                  direct marketing communications, including, but not limited
                  to, sending newsletters, and notifying you of promotions,
                  offers and events via email to advertise the Services. Except
                  where consent is required, we undertake such marketing and
                  advertising on the basis of our legitimate business interests.
                  Where we seek your consent, you may withdraw your consent at
                  any time.
                </li>

                <li>
                  <strong>
                    To comply with legal obligations and to defend Recall
                    against legal claims or disputes.
                  </strong>{" "}
                  We may use your personal information to comply with our legal
                  obligations or when it is in our legitimate business
                  interests, which includes to:
                  <ul className="ml-6 mt-2 list-inside list-disc space-y-1">
                    <li>
                      Comply with applicable laws, lawful requests, and legal
                      process, such as to respond to subpoenas or requests from
                      government authorities;
                    </li>
                    <li>
                      Protect our, your or others' rights, privacy, safety or
                      property (including by making and defending legal claims);
                    </li>
                    <li>
                      Audit our compliance with legal and contractual
                      requirements and internal policies;
                    </li>
                    <li>
                      Enforce the terms and conditions that govern the Services;
                      and
                    </li>
                    <li>
                      Protect the security of and manage access to our premises
                      and prevent, identify, investigate and deter fraudulent,
                      harmful, unauthorized, unethical or illegal activity,
                      including cyberattacks and identity theft.
                    </li>
                  </ul>
                </li>

                <li>
                  <strong>
                    To facilitate corporate acquisitions, mergers or
                    transactions.
                  </strong>{" "}
                  We may use your personal information, when it is in our
                  legitimate business interests, when we do a business deal, or
                  negotiate a business deal, involving the sale or transfer of
                  all or a part of our business or assets. These deals can
                  include any merger, financing, acquisition, or bankruptcy
                  transaction or proceeding.
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold">
                3. How We Share Personal Information
              </h2>
              <p className="mb-4">We may share personal information with:</p>

              <ul className="mb-4 list-inside list-disc space-y-3">
                <li>
                  <strong>Service providers.</strong> We may share personal
                  information with companies and individuals that provide
                  services on our behalf or help us operate our Services or our
                  business. These service providers include hosting services,
                  communications, LLM and other AI service providers, payment
                  processing services, identity verification, fraud detection,
                  investigation and prevention services, web and mobile
                  analytics, and email and communication distribution and
                  monitoring services.
                </li>

                <li>
                  <strong>Professional advisors.</strong> We share personal
                  information with professional advisors, such as lawyers,
                  auditors, bankers and insurers, where necessary in the course
                  of the professional services that they render to us.
                </li>

                <li>
                  <strong>Authorities and others.</strong> We may share personal
                  information with law enforcement, government authorities, and
                  private parties, as we believe in good faith to be necessary
                  or appropriate.
                </li>

                <li>
                  <strong>Business transferees.</strong> We may share personal
                  information with acquirers and other relevant participants in
                  business transactions (or negotiations for such transactions)
                  involving a corporate divestiture, merger, consolidation,
                  acquisition, reorganization, sale or other disposition of all
                  or any portion of the business or assets of, or equity
                  interests in, us (including, in connection with a bankruptcy
                  or similar proceedings).
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold">4. Cookies</h2>

              <h3 className="mb-3 text-xl font-semibold">
                a. What are cookies?
              </h3>
              <p className="mb-4">
                Cookies are small text files placed onto your device (computer,
                mobile phone, etc.) by certain websites that you visit and
                generally collect standard internet log information and visitor
                behavior information. They are widely used to make websites
                work, or work more efficiently, as well as to provide
                information to the owners of the website.
              </p>

              <p className="mb-4">
                Cookies can be 'first-party' or 'third-party' depending on the
                domain that sets them. First-party cookies are set by us and
                information collected from these cookies is used by us in
                accordance with our Privacy Policy. Third-party cookies are set
                by third parties and information is collected and used in
                accordance with those parties' privacy policies. Our Website
                uses both persistent and session cookies:
              </p>

              <ul className="mb-4 list-inside list-disc space-y-2">
                <li>
                  <strong>Session Cookies.</strong> These cookies are temporary
                  cookies that remain on your computer or device until you leave
                  our Website. They allow our Website to link your actions
                  during a browser session. We may use these for a variety of
                  purposes such as remembering what you clicked on, on the
                  previous page visited. A session starts when a user opens a
                  browser window and ends when the browser window is closed,
                  following which all session cookies expire and are deleted;
                </li>

                <li>
                  <strong>Persistent Cookies.</strong> These cookies remain on
                  your device for much longer or until you manually delete them
                  (how long the cookie remains on your device will depend on the
                  duration or "lifetime" of the specific cookie, as well as your
                  browser settings). Persistent cookies may be used for a
                  variety of purposes including remembering users' preferences
                  and choices when using a website.
                </li>
              </ul>

              <h3 className="mb-3 text-xl font-semibold">
                b. How we use cookies
              </h3>
              <p className="mb-4">
                To give you the best experience possible, we use the following
                types of cookies:
              </p>

              <ul className="mb-4 list-inside list-disc space-y-2">
                <li>
                  <strong>Strictly Necessary.</strong> These cookies are
                  necessary for our Website to function correctly. They enable
                  you to move around our Website and use our Website features.
                  As these cookies are necessary for the provision of our
                  Website to you, we do not require your consent for their use.
                </li>

                <li>
                  <strong>Analytics.</strong> These cookies help us understand
                  how you interact with our Website by providing information
                  such as the pages visited, the time spent on the Website, and
                  any issues encountered, such as error messages. The
                  information these cookies collect are for the purposes of
                  generating aggregated statistics and they help us improve the
                  way our Website works. Where required by law, we will obtain
                  your consent before placing Analytics Cookies on your device.
                </li>
              </ul>

              <p className="mb-4">
                Depending on your location, the maximum expiration period for
                the cookies above is two years.
              </p>

              <h3 className="mb-3 text-xl font-semibold">
                c. How to control cookies
              </h3>
              <p className="mb-4">
                Depending on where you access the Services from, you may be
                presented with a cookie banner or other tool to provide
                permissions prior to cookies other than Strictly Necessary
                Cookies being set. In this case, we will only set these cookies
                with your consent.
              </p>

              <p className="mb-4">You can also limit tracking by:</p>

              <ul className="mb-4 list-inside list-disc space-y-2">
                <li>
                  <strong>Blocking cookies on your browser.</strong> Most
                  browsers let you remove or reject cookies. To do this, follow
                  the instructions in your browser settings. If you disable or
                  delete cookies, however, you may have to manually adjust some
                  preferences every time you visit the Website and some
                  functionalities may not work. Please see the following links
                  for instructions on how to turn off or delete cookies on
                  popular browsers: Chrome, Firefox, Microsoft Edge, Safari
                  (Mac), Safari (Mobile/IOS). For more information on cookies
                  and how they can be managed and deleted please visit
                  www.allaboutcookies.org.
                </li>

                <li>
                  <strong>Google Analytics.</strong> We use Google Analytics to
                  help us better understand how people engage with our Services
                  by collecting information and creating reports about how users
                  use our Services. For more information on Google Analytics,
                  click here. You can opt out of Google Analytics by downloading
                  and installing the browser plug-in available at:
                  https://tools.google.com/dlpage/gaoptout.
                </li>

                <li>
                  <strong>Using privacy plug-ins or browsers.</strong> You can
                  block our services from setting cookies by using a browser
                  with privacy features, like Brave, or installing browser
                  plugins like Privacy Badger, Ghostery or uBlock Origin, and
                  configuring them to block third party cookies/trackers.
                </li>
              </ul>

              <p className="mb-4">
                Note that because these opt-out mechanisms are specific to the
                device or browser on which they are exercised, you will need to
                opt out on every browser and device that you use.
              </p>

              <h3 className="mb-3 text-xl font-semibold">d. Do Not Track</h3>
              <p className="mb-4">
                Some Internet browsers may be configured to send "Do Not Track"
                signals to the online services that you visit. We currently do
                not respond to "Do Not Track" or similar signals. To find out
                more about "Do Not Track," please visit
                http://www.allaboutdnt.com.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold">5. Your Rights</h2>
              <p className="mb-4">
                Depending on where you are based, and as provided under
                applicable law and subject to any limitations in such law, you
                may have the right to:
              </p>

              <ul className="mb-4 list-inside list-disc space-y-2">
                <li>Access your personal information;</li>
                <li>
                  Correct incomplete or inaccurate data we hold about you;
                </li>
                <li>
                  Ask us to erase the personal information we hold about you;
                </li>
                <li>
                  Ask us to restrict our handling of your personal information;
                </li>
                <li>
                  Receive any personal information we hold about you in a
                  structured and commonly used machine readable format or have
                  such personal information transmitted to another company;
                </li>
                <li>Object to how we are using your personal information;</li>
                <li>
                  Withdraw your consent to us handling your personal
                  information.
                </li>
              </ul>

              <p className="mb-4">
                Requests can be made to: data-privacy@recall.foundation. You may
                update or correct information about yourself by emailing us at
                data-privacy@recall.foundation.
              </p>

              <p className="mb-4">
                Please note that, prior to any response to the exercise of such
                rights, we may require you to verify your identity. Depending on
                where you reside, you may be entitled to empower an "authorized
                agent" to submit requests on your behalf. We will require
                authorized agents to confirm their identity and authority, in
                accordance with applicable laws. You are entitled to exercise
                the rights described above free from discrimination. In
                addition, we may have valid legal reasons to refuse your
                request, and will inform you if that is the case.
              </p>

              <p className="mb-4">
                <strong>Limits on your privacy rights and choices.</strong> In
                some instances, your choices may be limited, such as where
                fulfilling your request would impair the rights of others, our
                ability to provide a service you have requested, or our ability
                to comply with our legal obligations and enforce our legal
                rights.
              </p>

              <p className="mb-4">
                <strong>
                  Unsubscribe from direct marketing communications.
                </strong>{" "}
                You may opt out of marketing-related communications by following
                the opt out or unsubscribe instructions contained in the
                marketing communication we send you. You may continue to receive
                service-related and other non-marketing communications.
              </p>

              <p className="mb-4">
                <strong>Do Not Track.</strong> Some Internet browsers may be
                configured to send "Do Not Track" signals to the online services
                that you visit. We currently do not respond to "Do Not Track" or
                similar signals. To find out more about "Do Not Track," please
                visit http://www.allaboutdnt.com.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold">6. Data Security</h2>
              <p className="mb-4">
                Recall maintains administrative, technical and physical
                safeguards designed to protect the your personal information
                against accidental, unlawful or unauthorized destruction, loss,
                alteration, access, disclosure or use. We implement appropriate
                technical and organizational measures to ensure an adequate
                level of security, while taking into account the technological
                reality, cost, scope, context and purposes of processing
                weighted against the severity and likelihood that processing
                could threaten individual rights and freedoms.
              </p>

              <p className="mb-4">
                While we take steps designed to protect your personal
                information, please be advised that no security system or means
                of transmitting data over the Internet can be guaranteed to be
                entirely secure, including concerns with respect to computer
                viruses, malicious software, and hacker attacks. We cannot and
                do not guarantee or warrant the security of your personal
                information or any information you disclose or transmit to us.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold">7. Data Retention</h2>
              <p className="mb-4">
                We may retain your personal information for as long as it is
                reasonably needed in order to maintain and expand our
                relationship and provide you with our Services; in order to
                comply with our legal and contractual obligations; or to protect
                ourselves from any potential disputes. To determine the
                appropriate retention period for personal information, we
                consider the amount, nature, and sensitivity of such data, the
                potential risk of harm from unauthorized use or disclosure of
                such personal information, the purposes for which we process it,
                and the applicable legal requirements. Please note that it may
                not be technically feasible to delete any information
                transmitted to and stored on the blockchain, and any such
                information may remain indefinitely.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold">8. Children</h2>
              <p className="mb-4">
                Our Services are not intended for use by children. If we learn
                that we have collected personal information through our Services
                from a child without the consent of the child's parent or
                guardian as required by law, we will endeavor to delete it.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold">
                9. Changes to this Privacy Policy
              </h2>
              <p className="mb-4">
                We reserve the right to modify this Privacy Policy at any time.
                If we make material changes to this Privacy Policy, we will
                notify you by updating the date of this Privacy Policy. We may
                also provide notification of changes in another way that we
                believe is reasonably likely to reach you, such as via e-mail
                (if you have an account where we have your contact information)
                or another manner.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold">10. Contact Us</h2>
              <p className="mb-4">
                If you have any specific questions about this Privacy Policy,
                you can reach us by email at data-privacy@recall.foundation.
              </p>

              <p className="mb-4">
                If you wish to lodge a complaint about how we process your
                personal information, you can contact us using the email
                provided above. We will endeavor to respond to your complaint as
                soon as possible. Depending on where you reside, such as if you
                reside in the European Economic Area or United Kingdom, you may
                have the right to complain to a data protection regulator where
                you live or work, or where you feel a violation has occurred.
              </p>

              <div className="mt-6 space-y-4">
                <div>
                  <p className="mb-2 font-semibold">
                    General Data Protection Regulation (GDPR) – European
                    Representative
                  </p>
                  <p className="mb-2">
                    Pursuant to Article 27 of the General Data Protection
                    Regulation (GDPR), the Recall Foundation has appointed
                    European Data Protection Office (EDPO) as its GDPR
                    Representative in the EU. You can contact EDPO regarding
                    matters pertaining to the GDPR:
                  </p>
                  <ul className="ml-4 list-inside list-disc">
                    <li>
                      by using EDPO's online request form:
                      https://edpo.com/gdpr-data-request/
                    </li>
                    <li>
                      by writing to EDPO at Avenue Huart Hamoir 71, 1030
                      Brussels, Belgium
                    </li>
                  </ul>
                </div>

                <div>
                  <p className="mb-2 font-semibold">
                    UK General Data Protection Regulation (GDPR) - UK
                    Representative
                  </p>
                  <p className="mb-2">
                    Pursuant to Article 27 of the UK GDPR, the Recall Foundation
                    has appointed EDPO UK Ltd as its UK GDPR representative in
                    the UK. You can contact EDPO UK regarding matters pertaining
                    to the UK GDPR:
                  </p>
                  <ul className="ml-4 list-inside list-disc">
                    <li>
                      by using EDPO's online request form:
                      https://edpo.com/uk-gdpr-data-request/
                    </li>
                    <li>
                      by writing to EDPO UK at 8 Northumberland Avenue, London
                      WC2N 5BY, United Kingdom
                    </li>
                  </ul>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      <Footer node={layoutData.footer || {}} />
    </>
  );
}

export async function getStaticProps() {
  try {
    return {
      props: {
        layoutData: data,
      },
      revalidate: 300,
    };
  } catch (error) {
    console.error("Error fetching layout data:", error);

    return {
      props: {
        layoutData: { menu: [], footer: {} },
      },
      revalidate: 60,
    };
  }
}
