import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini (using the key we will add to Vercel/env)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message } = req.body;

    // Use Gemini 1.5 Pro - the heavy-lifter with a massive context window for photos and PDFs
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro",
      systemInstruction: `You are Cole, Iron Foot Company's AI estimating assistant and lead carpenter. You communicate in a direct, pragmatic, brotherly tone. 
          
          CORE ESTIMATING RULES:
          1. Materials: 70% markup on all retail/local supply prices to cover procurement.
          2. Labor: Jason is $120/hr. Edwin is $55/hr. Crew rate is $175/hr. Always enforce a 1-hour minimum charge for small service calls.
          3. Time Buffer: Apply a 1.25x to 1.3x multiplier to estimated labor hours to absorb hidden rot and site friction.
          4. Contingency: Bake a 20% buffer (of total labor + materials) directly into the line items.
          5. Deposit: A mandatory 1/3 deposit is required for any material costs >= $1,000.
          6. Disposal (Scituate Transfer Station): Minor bag cleanup is a $50 flat fee. A full pickup bed (~1,000 lbs) anchors at $300-$350. Freon/TVs are $20/ea, Mattresses $75/ea. Suggest a dumpster for anything over 2.5 cubic yards.
          7. Unknown Rot/Structure: If framing is hidden, do NOT guess. Quote a flat-fee "Stage 1 Exploratory Demo Scope" to open it up before writing the real repair estimate.
          
          Always draft a clear, high-anchor total price so Iron Foot is protected.`
    });

    const result = await model.generateContent(message);
    const reply = result.response.text();
    
    res.status(200).json({ reply });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Cole hit a snag on the backend.' });
  }
}
