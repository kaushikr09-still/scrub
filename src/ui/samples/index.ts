// Example texts for the "Load example" buttons. Everything in them is invented: example.com addresses,
// made-up people and firms, test-vector ID numbers, and phone numbers in the 98765 range.
import type { PresetId } from "../review";

export const SAMPLES: Record<PresetId, string> = {
  resumes: `MEERA IYENGAR
Software Engineer
Email: meera.iyengar@example.com | Phone: +91 98765 43210
Portfolio: https://meera-iyengar.example.com/portfolio
Address: 14 Lake View Road, Indiranagar, Bengaluru 560038

Personal details
Date of birth: 14/03/1996
Father's Name: Suresh Iyengar
Aadhaar: 2345 6789 0124
PAN: ABCDE1234F
UPI: meera.iyengar@okexample

Experience
Brightwell Software Pvt Ltd, Bengaluru (June 2021 to present)
Built billing tools for small shops. Reduced invoice errors by 40 percent. Current CTC: Rs. 18,50,000 per year.
GSTIN of the firm (for client invoices): 29AABCU9603R1ZJ

Skills
TypeScript, Python and SQL. Worked with small teams, wrote clear documentation, and mentored two interns on testing and code review.

Education
B.E. Computer Science, Anand Institute of Technology, Chennai (2014 to 2018)

Banking (for the joining form)
A/c No: 000123456789012
IFSC: HDFC0001234
Salary credit card: 4242 4242 4242 4242

Declaration
I confirm that the details above are correct.
MEERA IYENGAR, 12 January 2025
Reference check: call Anil Menon on 98765 43211 or write to anil.menon@example.com.`,

  business: `Subject: Invoice 2291 and the Pune site visit

Dear Ms. Kapoor,

Thank you for meeting us on 5 March 2025. As agreed, our firm, Northgate Traders Pvt Ltd, will send the revised quote for the Pune warehouse project. Please keep Rs. 2,45,000 ready as the advance.

Payment details:
Beneficiary: Northgate Traders Pvt Ltd
Account No: 000987654321097
IFSC: ICIC0001234
GSTIN: 27AAPFU0939F1ZV
UPI: northgate@okexample
PIN code of the site: 411014

Our site manager VIKRAM DESHMUKH will meet you at the gate. His mobile is 98765 43212 and his email is vikram.deshmukh@example.com. If he is not reachable, write to accounts@example.com or call me on +91 98765 43213.

For the portal, log in from 203.0.113.45 and open https://portal.example.com/orders/2291. Our card on file ends the same as the test card 4000 0566 5566 5556.

Please send your Aadhaar number 2345 6789 0124 and PAN ABCDE1234F for the vendor form.

Warm regards,
Nandini Rao
Northgate Traders Pvt Ltd, Pune`,

  chat: `[10:02] Ravi: Hi, I am calling about my refund. Order 5531.
[10:03] Support (Kavya): Hello Ravi. Can you share your registered email and phone?
[10:03] Ravi: ravi.nair@example.com, 98765 43214
[10:04] Support (Kavya): Thank you. Your refund of Rs. 3,499 was sent on 22/02/2025 to UPI ravi.nair@okexample. Is that right?
[10:05] Ravi: haan ji, wahi hai. lekin paisa abhi tak nahi aaya, kya karun? mera account number 000456789012346 hai, IFSC SBIN0001234.
[10:06] Support (Kavya): Samajh gaya. Please wait 2 din, aur agar nahi aaya toh batana.
[10:07] Ravi: theek hai. The card holder is my wife, PRIYA NAIR. Woh bhi isi card se pay karti hai: 4242 4242 4242 4242.
[10:08] Support (Kavya): Noted. For identity check please confirm your PAN ABCDE1234F and Aadhaar 2345 6789 0124.
[10:09] Ravi: Sure. PAN ABCDE1234F, Aadhaar 2345 6789 0124. Delivery PIN 600042, Chennai.
[10:10] Support (Kavya): Thanks. Ticket link: https://help.example.com/tickets/5531. Logged from IP 203.0.113.77.
[10:11] Ravi: ok. aap Mr. Arjun Pillai se baat kar lo, woh manager hain, unka number 98765 43215 hai.`,
};

export const PRESET_ORDER: readonly PresetId[] = ["resumes", "business", "chat"];
