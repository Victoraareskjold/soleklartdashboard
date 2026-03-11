export const buildMentionEmail = (
  authorName: string,
  lead: { person_info: string; address: string; id: string },
  content: string,
  origin: string,
) => ({
  subject: `Du ble nevnt i en merknad på lead: ${lead.person_info}`,
  html: `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 5px; overflow: hidden;">
      <div style="background-color: #4f46e5; color: white; padding: 20px; text-align: center;">
        <h1>Soleklart Dashboard</h1>
      </div>
      <div style="padding: 20px;">
        <h2 style="color: #4f46e5;">Du ble nevnt</h2>
        <p><strong>${authorName}</strong> nevnte deg i en merknad på leadet <strong>${lead.person_info}</strong>.</p>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 3px solid #4f46e5;">
          <p style="margin: 0;">${content.replace(/@\[([^\]]+)\]/g, "<strong>@$1</strong>")}</p>
        </div>
        <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
        <div>
          <h3 style="color: #4f46e5;">Lead Detaljer:</h3>
          <p><strong>Navn:</strong> ${lead.person_info}</p>
          <p><strong>Adresse:</strong> ${lead.address}</p>
        </div>
        <div style="text-align: center; margin-top: 30px;">
          <a href="${origin}/leads/${lead.id}?tab=Merknader"
             style="background-color: #4f46e5; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Vis Lead
          </a>
        </div>
      </div>
      <div style="background-color: #f2f2f2; text-align: center; padding: 15px; font-size: 12px; color: #666;">
        <p>Dette er en automatisk varsling fra Soleklart Dashboard.</p>
      </div>
    </div>
  `,
});
