// Sample transcripts for the "Load sample" affordance.
// Embed VERBATIM per Phase 1 brief.

export const MODES = [
  { value: "clinical", label: "Clinical (Doctor)" },
  { value: "sales", label: "Sales call" },
  { value: "interview", label: "Job interview" },
  { value: "intake", label: "Client intake" },
];

export const SAMPLES = {
  clinical: `Doctor: Morning — what brings you in today?
Patient: Sore throat and fever for three days, and a bad cough.
Doctor: Any trouble breathing?
Patient: No, just the cough, and I'm really tired.
Doctor: Let me look… throat's quite red, tonsils swollen. Temp is 38.6. Chest is clear.
Doctor: Looks like a bacterial throat infection. I'll start you on antibiotics — fluids and rest.
Patient: Okay, thank you.`,

  sales: `Rep: Thanks for hopping on — what's prompting you to look at a new tool now?
Prospect: Our CRM is clunky and the team hates logging calls.
Rep: How big is the team?
Prospect: About 20 reps.
Rep: What does success look like in six months?
Prospect: Honestly, reps actually using it. We've tried two tools already.
Rep: Who else is involved in the decision?
Prospect: Me and our VP of Sales.
Rep: Great — I'll send some info over.`,

  interview: `Interviewer: Walk me through your last role.
Candidate: Backend engineer for three years — Python and Postgres, led a team of four on a payments service.
Interviewer: Hardest problem you solved?
Candidate: A race condition causing double charges. I redesigned the locking — dropped to zero.
Interviewer: How do you like to work with a team?
Candidate: Lots of autonomy, heavy code review.
Interviewer: Great, that's all my questions.`,

  intake: `Us: What are you hoping to achieve?
Client: New cafe — we need to get found online and start getting orders.
Us: On Zomato and Swiggy yet?
Client: No, nothing set up.
Us: Do you have a logo and brand colors?
Client: Just a logo.
Us: Timeline?
Client: We open in three weeks.
Us: Perfect — we'll put a plan together.`,
};
