import nodemailer from "nodemailer";

export async function POST(req: Request) {
  const { to, subject, html } = await req.json();

  const transporter = nodemailer.createTransport({
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.NEXT_PUBLIC_OUTLOOK_EMAIL,
      pass: process.env.NEXT_PUBLIC_OUTLOOK_APP_PASSWORD,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: process.env.OUTLOOK_EMAIL,
      to,
      subject,
      html,
    });

    return Response.json({ success: true, messageId: info.messageId });
  } catch (err) {
    console.error(err);
    return new Response("Failed to send email", { status: 500 });
  }
}
