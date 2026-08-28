"""
Generates data/payments.json -- the payment card industry deck.

Scope follows the ground covered by Ahmed Siddiqui's "The Anatomy of the Swipe"
(the four-party model, the authorization/clearing/settlement lifecycle,
interchange and the economics, card data and EMV, risk and compliance, and the
rails underneath), broadened with the terms you meet alongside them in practice.

The definitions here are written from general, widely documented industry
knowledge -- scheme rulebooks, PCI SSC material, network developer docs -- not
transcribed from that or any other book.

Card shape: `glossary`, term on the front, meaning on the back. Deliberately
NOT reversible: unlike a translation pair, several of these definitions are
close enough that going definition -> term would have more than one defensible
answer.

Run: npm run cards:pay
"""
import json, os, re

cards = []

def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

GROUPS = {
    "Players":  "Who is involved",
    "Flow":     "The transaction",
    "Money":    "Fees and economics",
    "Cards":    "The card itself",
    "Risk":     "Risk and compliance",
    "Rails":    "Rails and messages",
}

def add(group, term, short, definition, context=""):
    cards.append({
        "id": f"pay-{slug(term)}", "group": group, "type": "glossary",
        "term": term, "short": short, "context": context,
        "definition": definition, "kind": GROUPS[group],
    })


# ============================ WHO IS INVOLVED ============================
P = "Players"
add(P, "Cardholder", "The person paying", "The consumer or business that holds the card and authorizes the payment.")
add(P, "Merchant", "The business getting paid", "The party selling goods or services and accepting the card as payment.")
add(P, "Issuer", "The cardholder's bank", "The bank that issues the card, owns the cardholder relationship, extends the credit or holds the deposits, and approves or declines each authorization.", "Four-party model")
add(P, "Acquirer", "The merchant's bank", "The bank licensed by the networks to accept card transactions on a merchant's behalf and deposit the proceeds into the merchant's account.", "Four-party model")
add(P, "Card network", "The rails and the rulebook", "Visa, Mastercard, Amex or Discover: routes messages between acquirer and issuer, sets interchange and the operating rules, and runs settlement.", "Also called the scheme")
add(P, "Four-party model", "Cardholder, merchant, issuer, acquirer", "The standard open-loop structure, with the card network in the middle moving messages and money between the issuer and the acquirer.")
add(P, "Three-party model", "The network is also the bank", "A closed structure where one company is network, issuer and acquirer at once, so it sets its own pricing. Amex and Discover began this way.")
add(P, "Open loop", "Works anywhere the network is taken", "A card usable at any merchant that accepts the network, because the network connects many issuers to many acquirers.")
add(P, "Closed loop", "Works in one place only", "A card accepted only by the issuing brand or a defined group, such as a store gift card, with no network in the middle.")
add(P, "Payment processor", "The plumbing", "The technology company that formats, transmits and reconciles transaction messages between the merchant, the acquirer, the network and the issuer.")
add(P, "Issuer processor", "Decides on the issuer's behalf", "Runs the authorization logic, balance checks and card records for an issuer, often for programs the bank does not build itself.")
add(P, "Acquirer processor", "Connects merchants to the networks", "Handles authorization routing, capture, settlement files and merchant funding on an acquirer's behalf.")
add(P, "Payment gateway", "The merchant's on-ramp", "Takes card details from a website or app, encrypts them and passes the transaction to the processor. Mostly a card-not-present concept.")
add(P, "Payment facilitator", "A merchant that resells acceptance", "A PayFac holds one master merchant account and onboards many sub-merchants underneath it, taking on their underwriting and risk.", "PayFac")
add(P, "Sub-merchant", "A merchant under a PayFac", "A business that accepts cards through a payment facilitator's master account rather than holding its own merchant account.")
add(P, "Independent Sales Organization", "Resells acquiring", "An ISO signs merchants up for card acceptance on behalf of an acquiring bank and is paid out of the merchant's processing fees.", "ISO; Mastercard calls it an MSP")
add(P, "Merchant of record", "Who is legally on the hook", "The entity that appears on the cardholder's statement and carries the legal and financial responsibility for the transaction, including refunds and chargebacks.")
add(P, "Sponsor bank", "Rents out network membership", "A licensed network member that lets a fintech or program manager issue or acquire under its membership, and stays accountable to the network for it.", "Also called a BIN sponsor")
add(P, "Program manager", "Runs the card program", "Handles the product, customer experience and day-to-day operations of a card program that sits on a sponsor bank's BIN.")
add(P, "Independent software vendor", "Software that also takes payments", "An ISV builds business software and embeds payment acceptance into it, often earning a share of the processing revenue.")
add(P, "Point of sale", "Where the card is presented", "The terminal, register or software that captures the card and starts the transaction. Abbreviated POS.")
add(P, "Digital wallet", "The card, on the phone", "Apple Pay, Google Pay and similar: hold a tokenized version of the card and present it over NFC or online.")
add(P, "Token service provider", "Issues and maps network tokens", "The party, usually the network, that swaps a real card number for a token and can map it back for the issuer.", "TSP")
add(P, "Network member", "A bank licensed by the scheme", "Only licensed members may issue or acquire directly; everyone else reaches the network through one.")
add(P, "Orchestration layer", "Routes between providers", "Software that lets a merchant send transactions to several processors or gateways and switch or retry between them.")

# ============================ THE TRANSACTION ============================
F = "Flow"
add(F, "Authorization", "Ask the issuer: yes or no", "A real-time request to the issuer to confirm the card is valid and the funds or credit are available. It reserves the amount but moves no money.", "Step 1 of 3")
add(F, "Clearing", "Exchange the records", "The acquirer submits the completed transaction and the network passes the record to the issuer, calculating what each side owes. Still no money has moved.", "Step 2 of 3")
add(F, "Settlement", "Move the money", "The actual transfer of funds between issuer and acquirer through the network's settlement accounts.", "Step 3 of 3")
add(F, "Funding", "Money reaches the merchant", "The acquirer deposits the settled proceeds, less fees, into the merchant's bank account. Usually a day or two after the sale.")
add(F, "Capture", "Claim the authorized amount", "The merchant tells the acquirer to collect a previously authorized amount, normally when the goods actually ship or the tab is closed.")
add(F, "Authorization hold", "Funds reserved, not taken", "The issuer reduces the cardholder's available balance by the authorized amount while waiting for the capture. It expires if never captured.")
add(F, "Batch", "A day's transactions together", "Captured transactions grouped and submitted for clearing in one file, traditionally at the end of the merchant's day.")
add(F, "Batch close", "Send the day in", "The cut-off at which a merchant submits its batch. Miss it and funding slips a day.")
add(F, "Pre-authorization", "Hold now, amount unknown", "An authorization taken before the final amount is known, as at a hotel check-in or a fuel pump.")
add(F, "Incremental authorization", "Top up the hold", "An additional authorization that raises an existing hold, used when a hotel stay or a bar tab grows.")
add(F, "Partial authorization", "Approve what is there", "The issuer approves less than requested because that is all the balance covers, letting the cardholder settle the rest another way. Common on prepaid.")
add(F, "Reversal", "Undo the authorization", "A message releasing a hold before it is captured, so the cardholder's available balance recovers straight away.")
add(F, "Void", "Cancel before it settles", "Cancelling a captured transaction while it is still in the open batch, so it never reaches clearing and never shows as a refund.")
add(F, "Refund", "Money back after the fact", "A separate transaction returning funds to the cardholder after the original one settled. It does not undo the original.")
add(F, "Chargeback", "The issuer takes it back", "A forced reversal initiated by the issuer after a cardholder dispute, pulling funds from the merchant and putting the burden of proof on them.")
add(F, "Representment", "The merchant pushes back", "The merchant supplies evidence contesting a chargeback and re-presents the transaction to the issuer.")
add(F, "Arbitration", "The network decides", "When issuer and merchant cannot resolve a dispute, the network rules on it and charges the loser a fee.")
add(F, "Pre-arbitration", "One more round first", "An attempt to settle a dispute between issuer and acquirer before it goes to the network for a binding decision.")
add(F, "Stand-in processing", "The network answers for the issuer", "When the issuer cannot be reached, the network approves or declines on its behalf within limits the issuer set in advance.", "STIP")
add(F, "Card-present", "The card is physically there", "A transaction where the card is dipped, tapped or swiped, so the terminal reads the chip or stripe. Lower risk, lower interchange.")
add(F, "Card-not-present", "No card at the terminal", "Online, in-app, phone or mail transactions where the card cannot be read. Higher fraud risk and higher interchange.", "CNP")
add(F, "MOTO", "Mail order, telephone order", "A card-not-present transaction taken by post or over the phone, with the details keyed in by the merchant.")
add(F, "Card on file", "Stored for next time", "A card the merchant has saved with the cardholder's agreement, used for repeat or one-click purchases.")
add(F, "Recurring transaction", "Charged on a schedule", "A repeating charge on a stored card, such as a subscription, flagged so the issuer treats it differently from a fresh purchase.")
add(F, "Authorization code", "Proof it was approved", "The short code the issuer returns on approval, quoted later to tie a settled transaction back to its authorization.")
add(F, "Force post", "Push it through anyway", "Submitting a transaction for clearing without a matching online authorization, using a code obtained another way. Carries extra liability.")
add(F, "Good funds model", "Do not spend what has not arrived", "Settling only once money is actually in hand, rather than advancing it and taking the risk.")

# ============================ FEES AND ECONOMICS ============================
M = "Money"
add(M, "Interchange", "Acquirer pays issuer", "The fee, set by the network, that the acquirer pays the issuer on each transaction. It is the largest part of what a merchant pays and it funds rewards and issuer risk.", "The biggest slice")
add(M, "Assessments", "The network's cut", "A fee the network charges on processed volume for use of its rails and brand. Small next to interchange, and paid by the acquirer.")
add(M, "Merchant discount rate", "All-in cost per sale", "The total a merchant pays per transaction: interchange, plus assessments, plus the processor's markup.", "MDR")
add(M, "Interchange-plus pricing", "Cost, then a stated markup", "Pricing that passes interchange and assessments straight through and adds a disclosed margin. The most transparent model.")
add(M, "Flat-rate pricing", "One headline number", "A single blended rate on every transaction regardless of card type. Simple, predictable, usually more expensive on average.")
add(M, "Tiered pricing", "Qualified, mid, non-qualified", "Pricing that sorts transactions into a few buckets whose definitions the processor controls. Opaque, and easy to downgrade into the expensive tier.")
add(M, "Downgrade", "Missed the cheaper rate", "A transaction that fails to meet the conditions for the interchange category it could have qualified for, and costs more as a result.")
add(M, "Basis point", "One hundredth of a percent", "The unit card pricing is quoted in. 100 bps is 1%.", "bps")
add(M, "Level 2 data", "Extra fields, cheaper rate", "Tax and customer reference data supplied on commercial card transactions to qualify for lower interchange.")
add(M, "Level 3 data", "Line-item detail", "Full line-item data on a commercial card transaction, which unlocks the lowest interchange for business and government spend.")
add(M, "Durbin Amendment", "Caps debit interchange", "A US rule capping debit interchange for large issuers and requiring that merchants have a choice of at least two unaffiliated debit networks.")
add(M, "Regulated debit", "Debit from a large issuer", "Debit cards from issuers over the Durbin asset threshold, whose interchange is capped. Unregulated debit, from small issuers, is not.")
add(M, "Least-cost routing", "Send it the cheaper way", "Choosing between the debit networks available on a card to minimize the merchant's cost.")
add(M, "Surcharge", "A fee for paying by card", "An extra amount added to the price for card payment. Permitted only within network rules and where local law allows.")
add(M, "Convenience fee", "Charge for the channel", "A fee for using a particular payment channel rather than for using a card as such, allowed in narrower circumstances than a surcharge.")
add(M, "Cash discount", "Lower price for cash", "Advertising a card price and discounting for cash, which achieves a similar result to surcharging under different rules.")
add(M, "Reserve", "Money held back", "Funds the acquirer withholds from a merchant against future chargebacks or failure to deliver.")
add(M, "Rolling reserve", "A moving holdback", "A reserve that keeps a set percentage of recent volume, releasing each tranche after an agreed period.")
add(M, "Chargeback fee", "Charged win or lose", "A fixed fee the acquirer charges the merchant for handling a dispute, usually payable whatever the outcome.")
add(M, "Gross settlement", "Fees billed separately", "Funding the merchant the full transaction amount and invoicing fees separately, rather than netting them off.")
add(M, "Net settlement", "Fees taken off the top", "Funding the merchant the transaction amount less fees, so the deposit is already net.")
add(M, "Float", "Value of the gap", "The economic benefit of holding funds between the moment they are collected and the moment they are paid out.")
add(M, "Revenue share", "Splitting the take", "An arrangement where a partner such as an ISV or ISO receives an agreed portion of the processing revenue it introduces.")
add(M, "Interchange optimization", "Qualify for cheaper rates", "Supplying the data and settling within the windows that let each transaction reach the lowest interchange category available to it.")

# ============================ THE CARD ITSELF ============================
C = "Cards"
add(C, "PAN", "The card number", "The Primary Account Number embossed or printed on the card, 13 to 19 digits, which identifies the issuer and the account.")
add(C, "BIN", "First six to eight digits", "The Bank Identification Number at the start of the PAN, identifying the issuer, the network, the country and the product type. Now formally the IIN.", "Also called IIN")
add(C, "Luhn check", "Catches typos, not fraud", "A checksum over the card number that detects most mistyped digits. It proves nothing about whether the account exists.")
add(C, "Expiration date", "When the plastic dies", "The month and year the card stops working, after which the issuer reissues. Used as a light verification field online.")
add(C, "CVV2", "The printed three digits", "The code printed on the card, not stored on the chip or stripe, used to suggest the card was in hand for a card-not-present sale.", "CVC2 on Mastercard")
add(C, "iCVV", "The chip's own code", "A separate verification value carried on the chip, different from the one on the magnetic stripe, so stripe data copied from a chip will not work.")
add(C, "Track data", "What the stripe holds", "The magnetic stripe's encoded fields: the PAN, expiry, service code and a verification value. Copying it is how counterfeit cards were made.")
add(C, "Magnetic stripe", "Static, copyable data", "The magnetic band on the back. It presents the same data every time, which is exactly why skimming worked.")
add(C, "EMV chip", "Different answer every time", "The chip that computes a unique cryptogram per transaction, so intercepted data cannot be replayed. Named for Europay, Mastercard and Visa.")
add(C, "Cryptogram", "Proof the real chip was there", "A one-time value the chip generates from transaction data and a secret key, which the issuer verifies. An ARQC is the authorization request cryptogram.", "ARQC")
add(C, "Application Identifier", "Which application to run", "The AID that tells the terminal which payment application on the chip to use, for example debit or credit on the same card.")
add(C, "Cardholder verification method", "How the person is checked", "The CVM: PIN, signature, on-device biometric or nothing at all. The chip and terminal negotiate which to use from a priority list.")
add(C, "Contactless", "Tap to pay", "Presenting the card or phone over NFC. Uses the same chip cryptography as a dip, so it is not the security step back that swiping was.")
add(C, "Service code", "What the card may do", "Three digits in the track data saying where the card is valid, whether a chip must be used, and what verification is required.")
add(C, "Network token", "A card number that is not the card number", "A network-issued substitute PAN, restricted to a merchant or device, which keeps working when the underlying card is reissued.")
add(C, "Payment Account Reference", "One id across all tokens", "PAR: a non-sensitive value linking every token and the real PAN for the same account, so a merchant can recognize a returning customer without holding card data.")
add(C, "Account updater", "Card details refresh themselves", "A network service that pushes new card numbers and expiry dates to merchants holding cards on file, so subscriptions survive reissues.")
add(C, "Virtual card", "A number with no plastic", "A card number generated for online or in-app use, often with limits on amount, merchant or lifetime.")
add(C, "Single-use card", "One number, one purchase", "A virtual card that expires after a single transaction, so a leak from the merchant is worthless.")
add(C, "Prepaid card", "Spends a loaded balance", "A card drawing on funds loaded in advance rather than a deposit account or a credit line.")
add(C, "Debit card", "Pulls from a deposit account", "A card that draws directly on the cardholder's own bank balance, usually with lower interchange than credit.")
add(C, "Credit card", "Borrows from the issuer", "A card drawing on a revolving credit line, where the issuer takes the credit risk and earns interest as well as interchange.")
add(C, "Charge card", "Borrow, but pay in full", "A card with no revolving balance: the whole amount falls due each cycle.")
add(C, "Commercial card", "A business's card", "Corporate, purchasing and fleet cards, which carry richer data requirements and their own interchange categories.")
add(C, "Card personalization", "Turning stock into a card", "Encoding the chip, printing the number and loading the keys that make a blank card belong to one account.")

# ============================ RISK AND COMPLIANCE ============================
R = "Risk"
add(R, "PCI DSS", "The rules for handling card data", "The Payment Card Industry Data Security Standard: the controls anyone storing, processing or transmitting card data must meet, set by the networks jointly.")
add(R, "PCI scope", "What the audit covers", "Every system that touches card data. Shrinking it, by never letting raw card data into your systems, is the cheapest way to reduce compliance burden.")
add(R, "Self-Assessment Questionnaire", "Prove it yourself", "The SAQ: the form smaller merchants complete to attest to PCI compliance, instead of a full on-site assessment.")
add(R, "Qualified Security Assessor", "The auditor", "A QSA is certified by the PCI Council to assess and attest to a company's compliance.")
add(R, "Tokenization", "Swap the number for a stand-in", "Replacing card data with a token that is useless if stolen, and can only be mapped back by the token service. The main tool for cutting PCI scope.")
add(R, "Point-to-point encryption", "Encrypted at the reader", "P2PE encrypts card data inside the terminal before it reaches the merchant's systems, so those systems never hold readable card data.")
add(R, "Hardware Security Module", "Where the keys live", "An HSM is tamper-resistant hardware that stores cryptographic keys and performs PIN and cryptogram operations without ever exposing the keys.")
add(R, "DUKPT", "A fresh key every time", "Derived Unique Key Per Transaction: each transaction is encrypted with its own key derived from a base key, so compromising one reveals nothing about the others.")
add(R, "3-D Secure", "Ask the issuer to vouch", "3DS adds an issuer authentication step to a card-not-present payment, and in return usually shifts fraud liability from the merchant to the issuer.")
add(R, "Liability shift", "Who eats the fraud", "The rules deciding whether the merchant or the issuer bears a fraudulent transaction. It moves with technology: EMV for card-present, 3DS for online.")
add(R, "EMV liability shift", "Whoever is least secure pays", "From the 2015 US milestone, the party that failed to support chip, merchant or issuer, bears counterfeit fraud losses.")
add(R, "Address Verification Service", "Check the billing address", "AVS compares the numeric parts of the billing address against the issuer's record. A weak signal on its own, useful combined with others.")
add(R, "Velocity check", "Too much, too fast", "A control that flags or blocks unusual bursts of activity on a card, device or account.")
add(R, "Card testing", "Probing stolen numbers", "Attackers running small or zero-value authorizations to find which stolen card numbers still work, often against a merchant's own checkout.")
add(R, "BIN attack", "Guessing the rest of the number", "Generating candidate card numbers from a known BIN and testing them until some authorize.")
add(R, "Skimming", "Copying the stripe", "A device on a terminal or ATM that reads and stores magnetic stripe data for later counterfeiting.")
add(R, "Shimming", "Skimming, for chips", "A thin device between chip and reader that captures chip data. Far less useful to an attacker, because the cryptogram cannot be replayed.")
add(R, "Friendly fraud", "The customer did buy it", "A cardholder disputing a transaction they actually made, whether by mistake or deliberately. Often indistinguishable from real fraud at first.")
add(R, "Account takeover", "The real account, the wrong person", "An attacker gaining control of a legitimate account and transacting as the cardholder.")
add(R, "Know Your Customer", "Prove who they are", "KYC: verifying the identity of a person before opening an account, required by anti-money-laundering rules.")
add(R, "Know Your Business", "Prove the business is real", "KYB: the equivalent checks on a business, its ownership and its beneficial owners, done when onboarding a merchant.")
add(R, "Anti-Money Laundering", "Stopping dirty money", "AML: the programme of monitoring, screening and reporting that regulated firms must run.")
add(R, "OFAC screening", "Checking the sanctions list", "Screening parties against US sanctions lists before doing business with them.")
add(R, "Underwriting", "Deciding whether to take the risk", "Assessing a merchant's business model, financials and chargeback exposure before granting acceptance, and setting reserves accordingly.")

# ============================ RAILS AND MESSAGES ============================
L = "Rails"
add(L, "ISO 8583", "The language of card messages", "The long-standing message format for card authorizations, with numbered fields and a message type indicator. Still what most card traffic speaks.")
add(L, "ISO 20022", "The richer, newer format", "An XML-based messaging standard with far more structured data, replacing older formats across wires and real-time payments.")
add(L, "Message Type Indicator", "What kind of message", "The MTI: four digits at the head of an ISO 8583 message saying what it is. 0100 is an authorization request, 0110 its response.")
add(L, "Dual message", "Authorize now, clear later", "Authorization and clearing sent as separate messages, which is what allows tips, partial captures and delayed shipping. The credit card norm.")
add(L, "Single message", "Authorize and clear at once", "One message that both authorizes and clears, typical of PIN debit, where the amount is final at the moment of sale.")
add(L, "PIN debit", "Debit over a debit network", "A debit transaction authenticated by PIN and routed over a debit network, usually cheaper for the merchant than signature debit.")
add(L, "Acquirer Reference Number", "The transaction's tracking number", "The ARN assigned during clearing, used to trace a specific transaction between acquirer, network and issuer, especially in disputes.")
add(L, "Retrieval Reference Number", "Another transaction identifier", "The RRN carried in the authorization message, used to match an authorization to its later clearing record.")
add(L, "Settlement file", "The day's ledger", "The file the network produces telling each member what it owes or is owed once the day's transactions are netted.")
add(L, "Reconciliation", "Making the numbers agree", "Matching authorizations, captures, settlement files and bank deposits against each other to find what is missing or wrong.")
add(L, "Pending transaction", "Authorized, not yet posted", "A hold visible to the cardholder that has reduced available balance but has not yet hit the statement.")
add(L, "Memo post", "A provisional ledger entry", "A temporary entry the issuer makes on authorization, replaced by the real posting when clearing arrives.")
add(L, "ACH", "Bank-to-bank batch transfer", "The Automated Clearing House: low-cost batched bank transfers used for payroll, bills and merchant funding. Days, not seconds, and reversible.")
add(L, "Same-day ACH", "ACH, but faster", "ACH processed in same-day windows rather than overnight, at a higher fee and within a value cap.")
add(L, "Wire transfer", "Fast, final, expensive", "A real-time, individually processed bank transfer that is effectively irrevocable once sent.")
add(L, "Real-Time Payments", "Instant and final", "The RTP network: bank-to-bank transfers that clear and settle in seconds, around the clock, and cannot be reversed.")
add(L, "FedNow", "The Fed's instant rail", "The US Federal Reserve's real-time payment service, launched in 2023 as an alternative to RTP.")
add(L, "Original Credit Transaction", "Pushing money to a card", "An OCT sends funds to a card rather than pulling them, which is how payouts and instant transfers to a debit card work.", "Push payment")
add(L, "Account Funding Transaction", "Pulling money to fund", "An AFT pulls money from a card to fund an account or wallet, and is flagged so the issuer knows it is not a purchase.")
add(L, "Push payment", "Sender starts it", "A payment the payer initiates, like a wire or an OCT. Hard to reverse, so a favourite of scammers.")
add(L, "Pull payment", "Recipient starts it", "A payment the payee initiates against permission given earlier, like a card charge or an ACH debit. Reversible, which is why disputes exist.")
add(L, "Scheme rules", "The network's rulebook", "The binding operating regulations every member agrees to, covering acceptance, disputes, branding, data and fees.")
add(L, "Open banking", "Bank data by permission", "Sharing bank account data and initiating payments through APIs with the account holder's consent, rather than by screen scraping.")

# ---- validate + write ----
ids = [c["id"] for c in cards]
dupes = sorted({i for i in ids if ids.count(i) > 1})
assert not dupes, "duplicate ids: " + str(dupes)

terms = {}
for c in cards:
    k = c["term"].lower()
    assert k not in terms, f"duplicate term {c['term']!r}: {terms[k]} and {c['id']}"
    terms[k] = c["id"]

for c in cards:
    assert len(c["short"]) <= 42, f"{c['id']}: short line too long for the card ({len(c['short'])})"

from collections import Counter
here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
json.dump(cards, open(os.path.join(here, "data", "payments.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=2)
print("TOTAL", len(cards))
print("group", dict(Counter(c["group"] for c in cards)))
