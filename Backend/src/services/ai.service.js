const { GoogleGenAI } = require("@google/genai")
const { z } = require("zod")
const { zodToJsonSchema } = require("zod-to-json-schema")
const puppeteer = require("puppeteer")

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY
})


const interviewReportSchema = z.object({
    matchScore: z.number().describe("A score between 0 and 100 indicating how well the candidate's profile matches the job describe"),
    technicalQuestions: z.array(z.object({
        question: z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach to take etc.")
    })).describe("Technical questions that can be asked in the interview along with their intention and how to answer them"),
    behavioralQuestions: z.array(z.object({
        question: z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach to take etc.")
    })).describe("Behavioral questions that can be asked in the interview along with their intention and how to answer them"),
    skillGaps: z.array(z.object({
        skill: z.string().describe("The skill which the candidate is lacking"),
        severity: z.enum([ "low", "medium", "high" ]).describe("The severity of this skill gap, i.e. how important is this skill for the job and how much it can impact the candidate's chances")
    })).describe("List of skill gaps in the candidate's profile along with their severity"),
    preparationPlan: z.array(z.object({
        day: z.number().describe("The day number in the preparation plan, starting from 1"),
        focus: z.string().describe("The main focus of this day in the preparation plan, e.g. data structures, system design, mock interviews etc."),
        tasks: z.array(z.string()).describe("List of tasks to be done on this day to follow the preparation plan, e.g. read a specific book or article, solve a set of problems, watch a video etc.")
    })).describe("A day-wise preparation plan for the candidate to follow in order to prepare for the interview effectively"),
    title: z.string().describe("The title of the job for which the interview report is generated"),
})



function sanitizeReport(report) {

  if (Array.isArray(report.technicalQuestions)) {
    report.technicalQuestions = report.technicalQuestions.map(q =>
      typeof q === "string"
        ? {
            question: q,
            intention: "Evaluate the candidate's technical understanding.",
            answer: "Explain the concept clearly with real examples and trade-offs."
          }
        : q
    )
  }

  if (Array.isArray(report.behavioralQuestions)) {
    report.behavioralQuestions = report.behavioralQuestions.map(q =>
      typeof q === "string"
        ? {
            question: q,
            intention: "Understand candidate's behaviour and teamwork ability.",
            answer: "Use the STAR method (Situation, Task, Action, Result)."
          }
        : q
    )
  }

  if (Array.isArray(report.skillGaps)) {
    report.skillGaps = report.skillGaps.map(s =>
      typeof s === "string"
        ? { skill: s, severity: "medium" }
        : s
    )
  }

  if (Array.isArray(report.preparationPlan)) {
    report.preparationPlan = report.preparationPlan.map((p, i) =>
      typeof p === "string"
        ? { day: i + 1, focus: p, tasks: ["Study topic", "Practice questions"] }
        : p
    )
  }

  return report
}
async function generateInterviewReport({ resume, selfDescription, jobDescription }) {
const trimmedResume = resume.substring(0, 3000)

   const prompt = `
You are a senior technical interviewer.

Analyze the following candidate profile.

RESUME:
${trimmedResume}

SELF DESCRIPTION:
${selfDescription}

JOB DESCRIPTION:
${jobDescription}

Return ONLY valid JSON in this exact structure:

{
 "matchScore": number,
 "title": string,
 "technicalQuestions": [
   {
     "question": string,
     "intention": string,
     "answer": string
   }
 ],
 "behavioralQuestions": [
   {
     "question": string,
     "intention": string,
     "answer": string
   }
 ],
 "skillGaps": [
   {
     "skill": string,
     "severity": "low" | "medium" | "high"
   }
 ],
 "preparationPlan": [
   {
     "day": number,
     "focus": string,
     "tasks": [string]
   }
 ]
}

IMPORTANT:
- technicalQuestions must contain 8 objects
- behavioralQuestions must contain 5 objects
- skillGaps must contain 3 objects
- preparationPlan must contain 7 objects

Return ONLY JSON.
`;
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: prompt,
        
        config: {
            responseMimeType: "application/json",
            responseSchema: zodToJsonSchema(interviewReportSchema),
        }
    })
console.log("AI RAW RESPONSE:", response.text)

let rawResponse

try {
  rawResponse = JSON.parse(response.text)
} catch (err) {
  throw new Error("AI returned invalid JSON")
}

let report = sanitizeReport(rawResponse)

try {
  report = interviewReportSchema.parse(report)
} catch (err) {
  console.error("Invalid AI structure:", report)
  throw new Error("AI response format incorrect")
}

return report




}



// async function generatePdfFromHtml(htmlContent) {
//    const browser = await puppeteer.launch({
//   args: ["--no-sandbox", "--disable-setuid-sandbox"]
// })
//     const page = await browser.newPage();
//     await page.setContent(htmlContent, { waitUntil: "networkidle0" })

//     const pdfBuffer = await page.pdf({
//         format: "A4", margin: {
//             top: "20mm",
//             bottom: "20mm",
//             left: "15mm",
//             right: "15mm"
//         }
//     })

//     await browser.close()

//     return pdfBuffer
// }
// async function generatePdfFromHtml(htmlContent) {
// const browser = await puppeteer.launch({
//   headless: true,
//   args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
//   executablePath: puppeteer.executablePath(), // <- THIS ensures Puppeteer finds its own Chrome
// })

//   const page = await browser.newPage()

//   await page.setContent(htmlContent, { waitUntil: "networkidle0" })

//   const pdfBuffer = await page.pdf({
//     format: "A4",
//     margin: {
//       top: "20mm",
//       bottom: "20mm",
//       left: "15mm",
//       right: "15mm"
//     }
//   })

//   await browser.close()

//   return pdfBuffer
// }

// async function generateResumePdf({ resume, selfDescription, jobDescription }) {

//     const resumePdfSchema = z.object({
//         html: z.string().describe("The HTML content of the resume which can be converted to PDF using any library like puppeteer")
//     })

//     // const prompt = `Generate resume for a candidate with the following details:
//     //                     Resume: ${resume}
//     //                     Self Description: ${selfDescription}
//     //                     Job Description: ${jobDescription}

//     //                     the response should be a JSON object with a single field "html" which contains the HTML content of the resume which can be converted to PDF using any library like puppeteer.
//     //                     The resume should be tailored for the given job description and should highlight the candidate's strengths and relevant experience. The HTML content should be well-formatted and structured, making it easy to read and visually appealing.
//     //                     The content of resume should be not sound like it's generated by AI and should be as close as possible to a real human-written resume.
//     //                     you can highlight the content using some colors or different font styles but the overall design should be simple and professional.
//     //                     The content should be ATS friendly, i.e. it should be easily parsable by ATS systems without losing important information.
//     //                     The resume should not be so lengthy, it should ideally be 1-2 pages long when converted to PDF. Focus on quality rather than quantity and make sure to include all the relevant information that can increase the candidate's chances of getting an interview call for the given job description.
//     //                 `
//     const prompt = `
// Generate a professional ATS-friendly resume in HTML format.

// Candidate Resume:
// ${resume}

// Self Description:
// ${selfDescription}

// Job Description:
// ${jobDescription}

// Instructions:
// - Tailor the resume for the given job description
// - Highlight relevant skills and projects
// - Use clean HTML structure
// - Keep the resume 1–2 pages when converted to PDF
// - Use simple styling (professional, ATS friendly)

// Return ONLY JSON like this:
// {
//   "html": "<html>...</html>"
// }
// `;
//     // const response = await ai.models.generateContent({
        
//     //     model:  "gemini-2.0-flash",
//     //     contents: prompt,
        
//     //     config: {
//     //         responseMimeType: "application/json",
//     //         responseSchema: zodToJsonSchema(resumePdfSchema),
//     //     }
        
//     // })
//     try {

//  const response = await ai.models.generateContent({
//     model: "gemini-2.5-flash-lite",
//     contents: prompt,
//     config: {
//         responseMimeType: "application/json",
//         responseSchema: zodToJsonSchema(resumePdfSchema),
//     }
//  })

//  console.log("AI RAW RESPONSE:", response.text)

// let jsonContent

// try {
//   jsonContent = JSON.parse(response.text)
// } catch (err) {
//   console.error("Invalid AI JSON:", response.text)
//   throw new Error("AI returned invalid JSON for resume")
// }
// const htmlContent = jsonContent.html.substring(0, 15000)

// const pdfBuffer = await generatePdfFromHtml(htmlContent)

//  return pdfBuffer

// } catch (error) {

//  if (error.status === 429) {
//     console.error("Rate limit hit! Cooling down...")
//  }

//  throw error
// }
// }
// module.exports = { generateInterviewReport, generateResumePdf }



// PDF generator (fail-safe for Render)
async function generatePdfFromHtml(htmlContent) {
  // Launch Puppeteer with proper Render args
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu"
    ],
    executablePath: puppeteer.executablePath() // ensures Puppeteer uses its downloaded Chromium
  })

  const page = await browser.newPage()

  // Wait until network is idle
  await page.setContent(htmlContent, { waitUntil: "networkidle0", timeout: 60000 })

  // Generate PDF
  const pdfBuffer = await page.pdf({
    format: "A4",
    margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
    printBackground: true
  })

  await browser.close()
  return pdfBuffer
}

// Generate Resume PDF from AI HTML
async function generateResumePdf({ resume, selfDescription, jobDescription }) {
  const resumePdfSchema = z.object({
    html: z.string().describe("HTML content of the resume to convert to PDF")
  })

  // Prompt for AI to generate professional resume HTML
  const prompt = `
Generate a professional ATS-friendly resume in HTML format.

Candidate Resume:
${resume}

Self Description:
${selfDescription}

Job Description:
${jobDescription}

Instructions:
- Tailor the resume to the job
- Highlight relevant skills and projects
- Keep it clean, simple, and professional
- 1-2 pages when converted to PDF

Return ONLY JSON like this:
{
  "html": "<html>...</html>"
}
`

  // Call Google Gemini AI
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-lite",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: zodToJsonSchema(resumePdfSchema)
    }
  })

  // Parse AI JSON safely
  let jsonContent
  try {
    jsonContent = JSON.parse(response.text)
  } catch (err) {
    console.error("AI returned invalid JSON:", response.text)
    throw new Error("AI returned invalid JSON for resume")
  }

  // Truncate huge HTML to prevent Puppeteer crash
  const htmlContent = jsonContent.html.substring(0, 15000)

  // Generate PDF safely
  const pdfBuffer = await generatePdfFromHtml(htmlContent)

  return pdfBuffer
}

module.exports = { generateInterviewReport, generateResumePdf, generatePdfFromHtml }