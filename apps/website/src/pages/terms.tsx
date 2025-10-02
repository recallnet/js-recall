/* eslint-disable react/no-unescaped-entities */
import { NextSeo } from "next-seo";

import { Footer } from "../components/Layout/Footer";
import { Header } from "../components/Layout/Header";
import data from "../data/home.json";
import { HomePageData } from "../types/components";

interface TermsProps {
  layoutData: HomePageData;
}

export default function Terms({ layoutData }: TermsProps) {
  return (
    <>
      <NextSeo
        title="Contest Terms and Conditions"
        description="Contest Terms and Conditions for Recall Foundation"
      />
      <Header node={layoutData.menu || []} />

      <main className="min-h-screen bg-[#0A0E13] text-white">
        <div className="mx-auto max-w-[1140px] px-[35px] py-24 lg:px-0">
          <h1 className="mb-8 text-4xl font-bold lg:text-5xl">
            RECALL FOUNDATION
            <br />
            CONTEST TERMS AND CONDITIONS
          </h1>

          <div className="prose prose-invert max-w-none space-y-6">
            <p className="mb-6">
              These Terms and Conditions ("Terms") govern participation in any
              hackathon or other similar contest (each a "Contest") organized,
              hosted, or otherwise facilitated by Recall Foundation ("Recall" or
              "Sponsor"). By registering for or participating in any Contest,
              you ("Participant" or "you") agree to be bound by these Terms,
              which are intended to apply across all Contests that Recall may
              organize from time to time, regardless of format, theme, or
              location (including virtual events). Additional event-specific
              rules, eligibility requirements, or guidelines ("Contest-Specific
              Rules") may also apply to individual Contests and will be made
              available prior to each event. In the event of any conflict, such
              additional Contest-Specific Rules will supplement and, to the
              extent necessary, supersede these Terms.
            </p>

            <p className="mb-6 font-bold">
              ANY CONTESTS ARE VOID WHERE PROHIBITED BY LAW. BY PARTICIPATING,
              YOU AGREE TO THESE TERMS AND CONDITIONS. NO ENTRY FEE.
            </p>

            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold">Eligibility</h2>
              <p className="mb-4">
                In order to be eligible to participate in any Contests, you
                represent and warrant that: (i) you are at least eighteen (18)
                years of age and possess the legal capacity to enter into a
                binding agreement with Recall; and (ii) you are not under any
                sanctions imposed or enforced by any national or international
                authority, nor should you be listed on any roster of prohibited
                or restricted entities, inclusive of, but not limited to, those
                maintained by the United Nations Security Council, the U.S.
                Government, the European Union or its Member States, or any
                other pertinent governmental authority. Furthermore, you are
                neither a citizen of nor domiciled within any nation or region
                subjected to comprehensive sanctions, including, but not limited
                to, Cuba; the Democratic People's Republic of Korea; the Crimea,
                Donetsk or Luhansk regions of Ukraine; Iran; or Syria.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold">Your Participation</h2>
              <p className="mb-4">
                Unless otherwise stated in the Contest-Specific Rules, (i) you
                can participate either as part of a team or on an individual
                basis; (ii) switching teams is not allowed; and (iii) Sponsor is
                not responsible for, and will not assist in resolving, any
                disputes between team members.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold">Entry Criteria</h2>
              <p className="mb-4">
                The guidelines for entries will be set forth in the
                Contest-Specific Rules. Unless otherwise stated in the
                Contest-Specific Rules, each team may only submit entry for a
                Contest (the "Entry"). Incomplete Entries or Entries that do not
                otherwise meet the criteria set forth in the Contest-Specific
                Rules may be disqualified.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold">Scoring of Entries</h2>
              <p className="mb-4">
                At least one representative from the Sponsor will be responsible
                for judging Entries. The Entries will be judged according to the
                following criteria specified in the Contest-Specific Rules.
              </p>
              <p className="mb-4">
                The Entry that earns the highest overall score will win. The
                decisions of the judges will be final. In the event of a tie,
                judges will deliberate to determine the winner. Each Participant
                or team must be available during the judging period to
                demonstrate the Participant's or team's Entry. The judging
                period may be extended by Sponsor for any length of time, in
                Sponsor's discretion. If a judge or Participant identifies to
                Sponsor a conflict of interest, that judge will be recused from
                judging the Entry with the conflict and an alternate judge will
                be identified as a substitution for the judge with the conflict.
                Each Entry must be original, of the Participant's or
                Participant's teams own creation and must not have been entered
                in any other competition or program similar to the applicable
                Contest, including other competitions conducted by Sponsor.
                Entries may be subject to a due diligence review at any time for
                eligibility and compliance with these Terms. Determination of
                eligibility and compliance is at the sole discretion of Sponsor.
                Sponsor reserve the right to disqualify any Entry if the Entry
                or a Participant or a Participant's team does not comply with
                these Terms. Sponsor reserves the right to conduct a KYC or
                other identity verification process to ensure the winner(s) meet
                the eligibility criteria set forth herein.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold">Ownership of Entries</h2>
              <p className="mb-4">
                Participant represents and warrants that the Entry does not
                violate any agreement or obligation to any invention assignment,
                proprietary information, confidentiality, non-solicitation,
                noncompetition or similar agreement with any employer or other
                person. Participant represents and warrants that the Entry is
                and will be Participant's own original work and does not and
                will not infringe the intellectual property or proprietary
                rights of any third party, including, without limitation, any
                third party patents, copyrights or trademarks. Participant
                hereby agrees not to instigate, support, maintain or authorize
                any action, claim or lawsuit against the Sponsor, or any other
                person, on the grounds that any use of a Participant's Entry,
                infringes any of Participant's rights as creator of the Entry,
                including, without limitation, trademark rights, copyrights and
                moral rights or "droit moral." Participant will retain ownership
                of its Entry; provided that Participant hereby grants Sponsor,
                its subsidiaries, agents and partner companies, a perpetual,
                irrevocable, worldwide, royalty-free, and non-exclusive license
                to use, reproduce, adapt, modify, publish, distribute, publicly
                perform, create a derivative work from, and publicly display the
                Entry: (a) for the purposes of allowing the Sponsor to evaluate
                the Entry for the applicable Contest, (b) for the purposes of
                improving the Sponsor and third party products, services,
                systems and networks and (c) in connection with advertising and
                promotion via communication to the public or other groups.
                Nothing herein shall constitute an employment, joint venture, or
                partnership relationship between Participant and Sponsor.
                Participants will not receive any compensation from Sponsor in
                connection with any Entries. Each Participant acknowledges and
                agrees that Sponsor or other Participants or third parties may
                have developed or commissioned works which are similar to the
                Entry of Participant or Participant's team, or may develop
                something similar in the future, and each Participant waives any
                claims that Participant may have resulting from any similarities
                to the Entry of Participant or Participant's team.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold">Prizes and Awards</h2>
              <p className="mb-4">
                The prizes and awards to be awarded will be specified in the
                Contest-Specific Rules. The odds of winning may depend on the
                total number of eligible Entries received. No substitution of
                prizes is permitted, except at the sole option of Sponsor for a
                prize of equal or greater value. Sponsor will not replace any
                lost or stolen prizes. Winners are solely responsible for any
                and all federal, state, provincial and local taxes, if any, that
                apply to prizes. Winners will be notified within ten (10)
                business days following conclusion of the judging process and
                may be required to sign and return an affidavit of eligibility
                and publicity/liability release within seven (7) days of
                notification and if applicable will be issued a 1099-MISC tax
                form. If a selected winner cannot be contacted, is ineligible,
                fails to claim a prize and/or where applicable an affidavit of
                eligibility and publicity/liability release is not timely
                received, is incomplete or modified, the prize may be forfeited
                and an alternate winner will be selected from remaining valid,
                eligible Entries timely submitted.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold">Publicity</h2>
              <p className="mb-4">
                Except where prohibited, by participating in a Contest,
                Participant consents to the use of his/her name, photo and/or
                likeness, biographical information, entry and statements
                attributed to Participant (if true) for advertising and
                promotional purposes, including without limitation, inclusion in
                Sponsor's newsletters, Sponsor's website at recall.network, and
                any of the Sponsor's social media accounts or outlets without
                additional compensation.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold">Indemnity</h2>
              <p className="mb-4">
                You agree to release, indemnify, defend and hold Sponsor and
                their parents, affiliates, subsidiaries, directors, officers,
                employees, sponsors and agents, including advertising and
                promotion agencies, and assigns, and any other organizations
                related to the Contests, harmless, from any and all claims,
                injuries, damages, expenses or losses to person or property
                and/or liabilities of any nature that in any way arise from
                participation in the applicable Contest or acceptance or use of
                a prize or parts thereof, including without limitation (i) any
                condition caused by events beyond Sponsor's control that may
                cause the applicable Contest to be disrupted or corrupted; (ii)
                any claim than an Entry infringes third party intellectual
                property or proprietary rights; (iii) any disputes among team
                members, (iv) any injuries, losses, or damages (compensatory,
                direct, incidental, consequential or otherwise) of any kind
                arising in connection with or as a result of the prize, or
                acceptance, possession, or use of the prize, or from
                participation in the applicable Contest; (v) any printing or
                typographical errors in any materials associated with the
                applicable Contest; technical errors that may impair your
                ability to participate in the applicable Contest; or (vi) errors
                in the administration of the applicable Contest.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold">DISCLAIMER</h2>
              <p className="mb-4">
                IN NO EVENT WILL SPONSOR BE LIABLE TO YOU FOR ANY DIRECT,
                SPECIAL, INCIDENTAL, EXEMPLARY, PUNITIVE OR CONSEQUENTIAL
                DAMAGES (INCLUDING LOSS OF USE, DATA, BUSINESS OR PROFITS)
                ARISING OUT OF OR IN CONNECTION WITH YOUR PARTICIPATION IN ANY
                CONTESTS, WHETHER SUCH LIABILITY ARISES FROM ANY CLAIM BASED
                UPON CONTRACT, WARRANTY, TORT (INCLUDING NEGLIGENCE), STRICT
                LIABILITY OR OTHERWISE, AND WHETHER OR NOT SPONSOR HAS BEEN
                ADVISED OF THE POSSIBILITY OF SUCH LOSS OR DAMAGE. Some
                jurisdictions do not allow the limitation or exclusion of
                liability for incidental or consequential damages, so the above
                limitation or exclusion may not apply to you.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold">General</h2>
              <p className="mb-4">
                The Contests are offered by Sponsor, which is not responsible
                for (i) late, lost, damaged, incomplete, or misdirected Entries,
                responses, or other correspondence, whether by e-mail or postal
                mail or otherwise; (ii) theft, destruction, unauthorized access
                to or alterations of Entries; or (iii) phone, electrical,
                network, computer, hardware, software program or transmission
                malfunctions, failures or difficulties. Sponsor reserves the
                right, in its sole discretion, to cancel, modify or suspend any
                Contests in whole or in part, in the event of fraud, technical
                or other difficulties or if the integrity of the Contest is
                compromised, without liability to the Participants. Sponsor
                reserves the right to disqualify any Participant, as determined
                by Sponsor, in its sole discretion. These Terms are governed by
                the law of the Cayman Islands, without reference to rules
                governing choice of laws, unless any laws where Participant is
                located prohibits the application of any extraterritorial laws.
                Sponsor's failure to enforce any term of these Terms shall not
                constitute a waiver of that provision.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold">
                Dispute Resolution Through Arbitration
              </h2>

              <h3 className="mb-3 text-xl font-semibold">
                Mandatory Arbitration of Disputes
              </h3>
              <p className="mb-4">
                Each party agrees that any dispute, claim or controversy arising
                out of or relating to these Terms or the breach, termination,
                enforcement, interpretation or validity thereof or any Contests
                (collectively, "Disputes") will be resolved solely by binding,
                individual arbitration and not in a class, representative or
                consolidated action or proceeding. You and Recall agree that
                Cayman Islands law governs the interpretation and enforcement of
                these Terms, and that you and Recall are each waiving the right
                to a trial by jury or to participate in a class action. This
                arbitration provision shall survive termination of these Terms.
              </p>

              <h3 className="mb-3 text-xl font-semibold">Exceptions</h3>
              <p className="mb-4">
                Notwithstanding the foregoing: (i) either party may seek to
                resolve a Dispute in the Summary Court of the Cayman Islands if
                it qualifies; (ii) either party retains the right to seek
                injunctive or other equitable relief from a court to prevent (or
                enjoin) the infringement or misappropriation of our intellectual
                property rights; and (iii) either party may assert individual
                claims in small claims court, if the claims qualify
                (collectively, "Excluded Claims").
              </p>

              <h3 className="mb-3 text-xl font-semibold">
                Conducting Arbitration and Arbitration Rules
              </h3>
              <p className="mb-4">
                Any Disputes arising out of or relating to these Terms,
                including the existence, validity, interpretation, performance,
                breach or termination thereof or any dispute regarding
                non-contractual obligations arising out of or relating to it
                shall be referred to and finally resolved by binding arbitration
                to be administered by the Cayman International Mediation and
                Arbitration Centre (CI-MAC) in accordance with the CI-MAC
                Arbitration Rules (the "Arbitration Rules") in force as at the
                date of these Terms, which Arbitration Rules are deemed to be
                incorporated by reference to these Terms. The arbitration shall
                be conducted in the English language and the place of
                arbitration shall be in a mutually agreed upon location. The
                arbitration shall be determined by a sole arbitrator to be
                appointed in accordance with the Arbitration Rules. The decision
                of the sole arbitrator to any such dispute, controversy,
                difference or claim shall be in writing and shall be final and
                binding upon both parties without any right of appeal, and
                judgment upon any award thus obtained may be entered in or
                enforced by any court having jurisdiction thereof. No action at
                law or in equity based upon any claim arising out of or in
                relation to these Terms shall be instituted in any court of any
                jurisdiction. If any litigation or arbitration is necessary to
                enforce the terms of these Terms, the prevailing party will be
                entitled to have their attorney fees paid by the other party.
                Each party waives any right it may have to assert the doctrine
                of forum non conveniens, to assert that it is not subject to the
                jurisdiction of such arbitration or courts or to object to venue
                to the extent any proceeding is brought in accordance herewith.
              </p>

              <h3 className="mb-3 text-xl font-semibold">Arbitration Costs</h3>
              <p className="mb-4">
                Responsibility of payment of all filing, administration and
                arbitrator fees will be governed by the Arbitration Rules. We
                each agree that the prevailing party in arbitration will be
                entitled to an award of attorneys' fees and expenses to the
                extent provided under applicable law.
              </p>

              <h3 className="mb-3 text-xl font-semibold">
                Injunctive and Declaratory Relief
              </h3>
              <p className="mb-4">
                Except for any Excluded Claims, the arbitrator shall determine
                all issues of liability on the merits of any claim asserted by
                either party and may award declaratory or injunctive relief only
                in favor of the individual party seeking relief and only to the
                extent necessary to provide relief warranted by that party's
                individual claim.
              </p>

              <h3 className="mb-3 text-xl font-semibold">
                Class Action Waiver
              </h3>
              <p className="mb-4">
                YOU AND RECALL AGREE THAT EACH MAY BRING CLAIMS AGAINST THE
                OTHER ONLY IN YOUR OR ITS INDIVIDUAL CAPACITY, AND NOT AS A
                PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS OR
                REPRESENTATIVE PROCEEDING. Further, if the parties' Dispute is
                resolved through arbitration, the arbitrator may not consolidate
                another person's claims with your claims, and may not otherwise
                preside over any form of a representative or class proceeding.
                If this specific provision is found to be unenforceable, then
                the entirety of this dispute resolution section shall be null
                and void.
              </p>

              <h3 className="mb-3 text-xl font-semibold">Severability</h3>
              <p className="mb-4">
                If an arbitrator or court of competent jurisdiction decides that
                any part of these Terms is invalid or unenforceable, the other
                parts of these Terms will still apply.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold">Winner's List</h2>
              <p className="mb-4">
                For a list of winners, send an email message to
                info@recall.foundation with "Winner's list" as the email subject
                and Contest name specified in the body of the e-mail.
              </p>
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
