// ============================================================
// PHASE 6: CSV Export
// ============================================================

function exportCSV() {
  const groups = APP_STATE.companyGroups;
  const auditRun = APP_STATE.auditRun;

  const headers = [
    'Company', 'Domain', 'Contact Name', 'Title', 'Email', 'LinkedIn',
    'Company Score', 'ICP Score', 'ICP Label', 'TVC Score', 'TVC Label',
    'Confidence', 'Contact Score', 'Contact Label',
    'Company Action', 'Contact Action',
    'Tier 1 Target', 'Existing Customer', 'Competitor', 'Referral Source',
    'Warm Path', 'Outreach Angle', 'Primary Solution', 'Outreach Hook',
    'LinkedIn Request', 'Reasoning'
  ];

  if (auditRun) {
    headers.push('Audit Verdict', 'Audit New Score', 'Audit Reasoning', 'Audit Contact Gap');
  }

  const rows = [];

  for (const group of groups) {
    const companyScore = Math.max(group.icpScore || 0, group.tvcScore || 0);
    const companyReasoning = group.reasoning || '';

    if (APP_STATE.isCompanyOnlyList || !group.contacts || group.contacts.length === 0) {
      // One row per company (no contact data)
      const row = [
        group.companyName,
        group.domain,
        '', '', '', '', // contact fields empty
        companyScore,
        group.icpScore || '',
        group.icpLabel || '',
        group.tvcScore || '',
        group.tvcLabel || '',
        group.confidence || '',
        '', '', // contact score/label empty
        group.companyAction || '',
        '', // contact action empty
        group.flags.isTier1Target ? 'YES' : 'NO',
        group.flags.isExistingCustomer ? 'YES' : 'NO',
        (group.flags.isCompetitor || group.flags.isTvcEligibleCompetitor) ? 'YES' : 'NO',
        group.isReferralSource ? 'YES' : 'NO',
        group.flags.warmPath || '',
        group.outreachAngle || '',
        group.primarySolution || '',
        group.outreachHook || '',
        '', // LinkedIn request empty
        companyReasoning
      ];

      if (auditRun) {
        row.push(
          group.auditVerdict || '',
          group.auditNewIcpScore || (group.auditVerdict === 'UPGRADE' || group.auditVerdict === 'DOWNGRADE' ? group.icpScore : ''),
          group.auditReasoning || '',
          group.auditContactGap || ''
        );
      }

      rows.push(row);
    } else {
      // One row per contact
      for (const contact of group.contacts) {
        const contactReasoning = contact.contactReasoning || '';

        const row = [
          group.companyName,
          group.domain,
          contact.name || '',
          contact.title || '',
          contact.email || '',
          contact.linkedin || '',
          companyScore,
          group.icpScore || '',
          group.icpLabel || '',
          group.tvcScore || '',
          group.tvcLabel || '',
          group.confidence || '',
          contact.contactScore || '',
          contact.contactLabel || '',
          group.companyAction || '',
          contact.contactAction || '',
          group.flags.isTier1Target ? 'YES' : 'NO',
          group.flags.isExistingCustomer ? 'YES' : 'NO',
          (group.flags.isCompetitor || group.flags.isTvcEligibleCompetitor) ? 'YES' : 'NO',
          group.isReferralSource ? 'YES' : 'NO',
          group.flags.warmPath || '',
          group.outreachAngle || '',
          group.primarySolution || '',
          group.outreachHook || '',
          contact.linkedinRequest || '',
          [companyReasoning, contactReasoning].filter(Boolean).join(' | ')
        ];

        if (auditRun) {
          row.push(
            group.auditVerdict || '',
            (group.auditVerdict === 'UPGRADE' || group.auditVerdict === 'DOWNGRADE') ? group.icpScore : '',
            group.auditReasoning || '',
            group.auditContactGap || ''
          );
        }

        rows.push(row);
      }
    }
  }

  const csv = Papa.unparse({ fields: headers, data: rows });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const date = new Date().toISOString().split('T')[0];
  a.download = `turnkey_scored_prospects_${date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
