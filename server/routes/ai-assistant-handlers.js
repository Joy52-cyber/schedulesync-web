/**
 * AI Assistant Intent Handlers with Validation
 * 
 * Includes validation for:
 * - Email addresses (format, MX, bounce history)
 * - Team existence
 * - Event type existence  
 * - Team member existence
 */

const { validateEmail, validateEmails, recordBounce, clearBounce } = require('../utils/emailValidator');

// ============ VALIDATION HELPERS ============

/**
 * Validate team exists and belongs to user
 */
async function validateTeam(pool, userId, teamName) {
  // Get all teams for the user
  const allTeamsResult = await pool.query(
    `SELECT id, name, team_booking_token FROM teams WHERE owner_id = $1 ORDER BY name`,
    [userId]
  );

  if (allTeamsResult.rows.length === 0) {
    return {
      valid: false,
      reason: 'no_teams',
      message: '❌ No teams found. Create a team first.',
      teams: []
    };
  }

  if (!teamName || teamName.trim() === '') {
    return {
      valid: false,
      reason: 'name_required',
      message: '🏢 Which team?',
      teams: allTeamsResult.rows
    };
  }

  // Search for team by name
  const teamResult = await pool.query(
    `SELECT id, name, team_booking_token
     FROM teams
     WHERE owner_id = $1 AND LOWER(name) LIKE LOWER($2)
     LIMIT 1`,
    [userId, `%${teamName}%`]
  );

  if (teamResult.rows.length === 0) {
    return {
      valid: false,
      reason: 'not_found',
      message: `❌ No team found matching "${teamName}".`,
      teams: allTeamsResult.rows
    };
  }

  return {
    valid: true,
    team: teamResult.rows[0],
    teams: allTeamsResult.rows
  };
}

/**
 * Validate event type exists and belongs to user
 */
async function validateEventType(pool, userId, eventTypeName) {
  // Get all event types for the user
  const allEventsResult = await pool.query(
    `SELECT id, title, slug, duration, is_active FROM event_types WHERE user_id = $1 ORDER BY title`,
    [userId]
  );

  if (allEventsResult.rows.length === 0) {
    return {
      valid: false,
      reason: 'no_event_types',
      message: '❌ No event types found. Create one in Event Types.',
      eventTypes: []
    };
  }

  if (!eventTypeName || eventTypeName.trim() === '') {
    return {
      valid: false,
      reason: 'name_required',
      message: '📅 Which event type?',
      eventTypes: allEventsResult.rows
    };
  }

  // Search for event type by name
  const eventResult = await pool.query(
    `SELECT * FROM event_types
     WHERE user_id = $1 AND LOWER(title) LIKE LOWER($2)
     LIMIT 1`,
    [userId, `%${eventTypeName}%`]
  );

  if (eventResult.rows.length === 0) {
    return {
      valid: false,
      reason: 'not_found',
      message: `❌ No event type found matching "${eventTypeName}".`,
      eventTypes: allEventsResult.rows
    };
  }

  return {
    valid: true,
    eventType: eventResult.rows[0],
    eventTypes: allEventsResult.rows
  };
}

/**
 * Validate team member exists
 */
async function validateTeamMember(pool, userId, memberName) {
  // Get all members from user's teams
  const allMembersResult = await pool.query(
    `SELECT tm.id, tm.name, tm.booking_token, t.name as team_name,
            u.email as user_email, u.name as user_name
     FROM team_members tm
     JOIN teams t ON tm.team_id = t.id
     LEFT JOIN users u ON tm.user_id = u.id
     WHERE t.owner_id = $1
     ORDER BY tm.name`,
    [userId]
  );

  if (allMembersResult.rows.length === 0) {
    return {
      valid: false,
      reason: 'no_members',
      message: '❌ No team members found. Add members to your teams first.',
      members: []
    };
  }

  if (!memberName || memberName.trim() === '') {
    return {
      valid: false,
      reason: 'name_required',
      message: '👤 Which team member?',
      members: allMembersResult.rows
    };
  }

  // Search for member by name
  const memberResult = await pool.query(
    `SELECT tm.id, tm.name, tm.booking_token, t.name as team_name,
            u.email as user_email, u.name as user_name
     FROM team_members tm
     JOIN teams t ON tm.team_id = t.id
     LEFT JOIN users u ON tm.user_id = u.id
     WHERE t.owner_id = $1 
       AND (LOWER(tm.name) LIKE LOWER($2) OR LOWER(u.name) LIKE LOWER($2))
     LIMIT 5`,
    [userId, `%${memberName}%`]
  );

  if (memberResult.rows.length === 0) {
    return {
      valid: false,
      reason: 'not_found',
      message: `❌ No team member found matching "${memberName}".`,
      members: allMembersResult.rows
    };
  }

  if (memberResult.rows.length > 1) {
    return {
      valid: true,
      multiple: true,
      members: memberResult.rows,
      allMembers: allMembersResult.rows
    };
  }

  return {
    valid: true,
    member: memberResult.rows[0],
    members: allMembersResult.rows
  };
}

/**
 * Format member list for display
 */
function formatMemberList(members) {
  return members.map(m => 
    `• ${m.user_name || m.name} (${m.team_name})`
  ).join('\n');
}

/**
 * Format team list for display
 */
function formatTeamList(teams) {
  return teams.map((t, i) => `${i + 1}. ${t.name}`).join('\n');
}

/**
 * Format event type list for display
 */
function formatEventTypeList(eventTypes) {
  return eventTypes.map(e => 
    `• ${e.title} (${e.duration} min) ${e.is_active ? '✅' : '⏸️'}`
  ).join('\n');
}

// ============ INTENT HANDLERS ============

/**
 * Handle get_member_link intent
 */
async function handleGetMemberLink(pool, userId, parsedIntent, usageData) {
  const memberName = parsedIntent.extracted?.member_name;
  const validation = await validateTeamMember(pool, userId, memberName);

  if (!validation.valid) {
    if (validation.reason === 'no_members') {
      return {
        type: 'info',
        message: validation.message,
        usage: usageData
      };
    }

    const memberList = formatMemberList(validation.members);
    return {
      type: validation.reason === 'name_required' ? 'clarify' : 'info',
      message: `${validation.message}\n\nAvailable members:\n${memberList}\n\nSay "Get [name]'s booking link"`,
      usage: usageData
    };
  }

  const baseUrl = process.env.FRONTEND_URL || 'https://trucal.xyz';

  // Multiple matches
  if (validation.multiple) {
    return {
      type: 'member_links',
      message: `Found ${validation.members.length} members matching "${memberName}":`,
      data: {
        members: validation.members.map(m => ({
          name: m.user_name || m.name || 'Team Member',
          team_name: m.team_name,
          url: `${baseUrl}/book/${m.booking_token}`,
          short_url: `/book/${m.booking_token.substring(0, 8)}...`
        }))
      },
      usage: usageData
    };
  }

  // Single match
  const member = validation.member;
  const memberUrl = `${baseUrl}/book/${member.booking_token}`;
  const displayName = member.user_name || member.name || 'Team Member';
  const displayEmail = member.user_email || 'No email';
  
  return {
    type: 'member_link',
    message: `👤 ${displayName}'s Booking Link\n\n📧 ${displayEmail}\n🏢 ${member.team_name}`,
    data: {
      url: memberUrl,
      short_url: `/book/${member.booking_token.substring(0, 8)}...`,
      name: displayName,
      email: displayEmail,
      team_name: member.team_name,
      type: 'member'
    },
    usage: usageData
  };
}

/**
 * Handle get_event_type intent
 */
async function handleGetEventType(pool, userId, parsedIntent, usageData) {
  const eventTypeName = parsedIntent.extracted?.event_type_name;
  const validation = await validateEventType(pool, userId, eventTypeName);

  if (!validation.valid) {
    if (validation.reason === 'no_event_types') {
      return {
        type: 'info',
        message: validation.message,
        usage: usageData
      };
    }

    const eventList = formatEventTypeList(validation.eventTypes);
    return {
      type: validation.reason === 'name_required' ? 'clarify' : 'info',
      message: `${validation.message}\n\nYour event types:\n${eventList}\n\nSay "Show my [event name]"`,
      usage: usageData
    };
  }

  // Get user info for username
  const userResult = await pool.query(
    `SELECT username, email FROM users WHERE id = $1`,
    [userId]
  );
  const username = userResult.rows[0]?.username || userResult.rows[0]?.email?.split('@')[0] || 'user';

  // Get booking stats
  const statsResult = await pool.query(
    `SELECT 
       COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_count,
       COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count
     FROM bookings WHERE event_type_id = $1`,
    [validation.eventType.id]
  );
  const stats = statsResult.rows[0];

  const et = validation.eventType;
  const baseUrl = process.env.FRONTEND_URL || 'https://trucal.xyz';
  const bookingUrl = `${baseUrl}/book/${username}/${et.slug}`;

  return {
    type: 'event_type',
    message: `📅 ${et.title}\n\n${et.is_active ? '✅ Active' : '⏸️ Inactive'}\n⏱️ Duration: ${et.duration} minutes\n💰 Price: ${et.price ? `$${et.price}` : 'Free'}\n📝 Description: ${et.description || 'None'}\n\n📊 Stats:\n   ✅ Confirmed: ${stats.confirmed_count || 0}\n   ❌ Cancelled: ${stats.cancelled_count || 0}`,
    data: {
      event_type: et,
      url: bookingUrl,
      short_url: `/${username}/${et.slug}`,
      type: 'event_type'
    },
    usage: usageData
  };
}

/**
 * Handle schedule_team_meeting intent
 */
async function handleScheduleTeamMeeting(pool, userId, parsedIntent, usageData) {
  const teamName = parsedIntent.extracted?.team_name;
  const teamValidation = await validateTeam(pool, userId, teamName);

  if (!teamValidation.valid) {
    if (teamValidation.reason === 'no_teams') {
      return {
        type: 'info',
        message: teamValidation.message,
        usage: usageData
      };
    }

    const teamList = formatTeamList(teamValidation.teams);
    return {
      type: teamValidation.reason === 'name_required' ? 'clarify' : 'info',
      message: `${teamValidation.message}\n\nYour teams:\n${teamList}\n\nSay "Schedule with [team name]"`,
      data: { teams: teamValidation.teams },
      usage: usageData
    };
  }

  const team = teamValidation.team;

  // Validate attendee emails if provided
  if (parsedIntent.extracted?.attendees && parsedIntent.extracted.attendees.length > 0) {
    const emailValidation = await validateEmails(parsedIntent.extracted.attendees, pool);
    
    if (!emailValidation.valid) {
      const invalid = emailValidation.invalidEmails[0];
      let errorMsg = `❌ Invalid email: ${invalid.error}`;
      if (invalid.suggestion) {
        errorMsg += `\n\n💡 Did you mean: ${invalid.suggestion}`;
      }
      
      return {
        type: 'error',
        message: errorMsg,
        data: { team, invalidEmail: invalid },
        usage: usageData
      };
    }

    // Warn about previous bounces
    if (emailValidation.warnings.length > 0) {
      const warning = emailValidation.warnings[0];
      return {
        type: 'warning',
        message: `⚠️ Warning: ${warning.email} has had delivery issues before. Email may not be delivered.\n\nDo you want to continue anyway?`,
        data: { team, email: warning.email },
        usage: usageData
      };
    }
  }

  // Check if we have all required booking info
  if (!parsedIntent.extracted?.date || !parsedIntent.extracted?.time) {
    return {
      type: 'clarify',
      message: `📅 When would you like to schedule with ${team.name}?\n\nExample: "tomorrow at 2pm" or "December 10 at 3:30pm"`,
      data: { team, partial_booking: parsedIntent.extracted },
      usage: usageData
    };
  }

  if (!parsedIntent.extracted?.attendees || parsedIntent.extracted.attendees.length === 0) {
    return {
      type: 'clarify',
      message: `👥 Who should I invite to this ${team.name} meeting?\n\nPlease provide their email address.`,
      data: { team, partial_booking: parsedIntent.extracted },
      usage: usageData
    };
  }

  // All info present - create confirmation
  const attendeeEmail = parsedIntent.extracted.attendees[0];
  const attendeeName = attendeeEmail
    .split('@')[0]
    .replace(/[._-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  const bookingData = {
    title: parsedIntent.extracted.title || `${team.name} Meeting`,
    date: parsedIntent.extracted.date,
    time: parsedIntent.extracted.time,
    duration: parsedIntent.extracted.duration_minutes || 30,
    attendees: parsedIntent.extracted.attendees,
    attendee_email: attendeeEmail,
    notes: parsedIntent.extracted.notes || `Meeting with ${attendeeName}`,
    team_id: team.id,
    team_name: team.name
  };

  return {
    type: 'confirmation',
    message: `✅ Ready to schedule ${team.name} meeting?\n\n📅 ${bookingData.date} at ${bookingData.time}\n👥 Attendees: ${bookingData.attendees.join(', ')}\n⏱️ Duration: ${bookingData.duration} minutes\n🏢 Team: ${team.name}\n📝 Notes: ${bookingData.notes}`,
    data: { bookingData },
    usage: usageData
  };
}

/**
 * Handle create_meeting intent
 */
async function handleCreateMeeting(pool, userId, parsedIntent, usageData) {
  // Validate attendee emails
  if (parsedIntent.extracted?.attendees && parsedIntent.extracted.attendees.length > 0) {
    const emailValidation = await validateEmails(parsedIntent.extracted.attendees, pool);
    
    if (!emailValidation.valid) {
      const invalid = emailValidation.invalidEmails[0];
      let errorMsg = `❌ Email validation failed: ${invalid.error}`;
      
      if (invalid.suggestion) {
        errorMsg += `\n\n💡 Did you mean: ${invalid.suggestion}`;
      }
      
      return {
        type: 'error',
        message: errorMsg,
        data: { invalid_email: invalid.email, reason: invalid.reason, suggestion: invalid.suggestion },
        usage: usageData
      };
    }

    // Warn about previous bounces but allow
    if (emailValidation.warnings.length > 0) {
      const warning = emailValidation.warnings[0];
      console.log(`Email warning for ${warning.email}:`, warning.warnings);
    }
  }

  // Required field validation
  if (!parsedIntent.extracted?.date || !parsedIntent.extracted?.time) {
    return {
      type: 'clarify',
      message: '📅 I need both a date and time to schedule your meeting.\n\nWhen would you like to meet?\n\nExample: "tomorrow at 2pm" or "December 10 at 3:30pm"',
      data: parsedIntent,
      usage: usageData
    };
  }

  if (!parsedIntent.extracted?.attendees || parsedIntent.extracted.attendees.length === 0) {
    return {
      type: 'clarify',
      message: '👥 Who should I invite to this meeting?\n\nPlease provide their email address.\n\nExample: john@company.com',
      data: parsedIntent,
      usage: usageData
    };
  }

  // Check missing fields
  const missing = parsedIntent.missing_fields || [];
  if (missing.length > 0 && !missing.every(f => ['title', 'notes'].includes(f))) {
    return {
      type: 'clarify',
      message: parsedIntent.clarifying_question || `I need a bit more information. What ${missing.join(' and ')} would work for you?`,
      data: parsedIntent,
      usage: usageData
    };
  }

  // All validation passed - prepare booking data
  const attendeeEmail = parsedIntent.extracted.attendees[0];
  const attendeeName = attendeeEmail
    .split('@')[0]
    .replace(/[._-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  const extractedNotes = parsedIntent.extracted.notes;
  const cleanNotes = (extractedNotes && extractedNotes !== 'null' && extractedNotes.trim() !== '') 
    ? extractedNotes 
    : `Meeting with ${attendeeName}`;

  const bookingData = {
    title: parsedIntent.extracted.title || 'Meeting',
    date: parsedIntent.extracted.date,
    time: parsedIntent.extracted.time,
    duration: parsedIntent.extracted.duration_minutes || 30,
    attendees: parsedIntent.extracted.attendees,
    attendee_email: attendeeEmail,
    notes: cleanNotes
  };
  
  return {
    type: 'confirmation',
    message: `✅ Ready to schedule "${bookingData.title}" for ${bookingData.date} at ${bookingData.time}?\n\n👥 Attendees: ${bookingData.attendees.join(', ')}\n⏱️ Duration: ${bookingData.duration} minutes\n📝 Notes: ${cleanNotes}`,
    data: { bookingData },
    usage: usageData
  };
}

/**
 * Handle send_email intent
 */
async function handleSendEmail(pool, userId, parsedIntent, usageData, helpers) {
  const { selectBestTemplate, sendEmailWithTemplate, trackTemplateUsage } = helpers;
  const { type, recipient, meeting_details } = parsedIntent.email_action;

  // Validate email
  const emailValidation = await validateEmail(recipient, pool);
  
  if (!emailValidation.valid) {
    let errorMsg = `❌ Invalid email: ${emailValidation.error}`;
    if (emailValidation.suggestion) {
      errorMsg += `\n\n💡 Did you mean: ${emailValidation.suggestion}`;
    }
    
    return {
      type: 'error',
      message: errorMsg,
      usage: usageData
    };
  }

  // Warn about previous bounces
  if (emailValidation.warnings && emailValidation.warnings.includes('previous_soft_bounce')) {
    return {
      type: 'warning',
      message: `⚠️ Warning: ${recipient} has had delivery issues before.\n\n${emailValidation.warningMessage}\n\nDo you want to send anyway?`,
      data: { recipient, type },
      usage: usageData
    };
  }

  // Validate email type
  const validTypes = ['reminder', 'confirmation', 'follow_up', 'cancellation'];
  if (!type || !validTypes.includes(type)) {
    return {
      type: 'clarify',
      message: `📧 What type of email would you like to send to ${recipient}?\n\nAvailable types:\n• Reminder\n• Confirmation\n• Follow-up\n• Cancellation`,
      usage: usageData
    };
  }

  // Check if template exists
  const template = await selectBestTemplate(userId, type, meeting_details);
  
  if (!template) {
    const templatesResult = await pool.query(
      `SELECT name, type FROM email_templates WHERE user_id = $1 ORDER BY type, name`,
      [userId]
    );

    if (templatesResult.rows.length === 0) {
      return {
        type: 'info',
        message: `❌ No ${type} email template found.\n\nCreate one in Email Templates, or I can send a default email.`,
        usage: usageData
      };
    }

    const templateList = templatesResult.rows.map(t => `• ${t.name} (${t.type})`).join('\n');
    return {
      type: 'info',
      message: `❌ No ${type} template found.\n\nYour templates:\n${templateList}`,
      usage: usageData
    };
  }

  // Prepare meeting details
  const emailDetails = {
    date: meeting_details?.date || new Date().toLocaleDateString(),
    time: meeting_details?.time || 'TBD',
    link: meeting_details?.link || 'Will be provided',
    title: meeting_details?.title || 'Meeting'
  };

  // Send email
  const emailSent = await sendEmailWithTemplate(template, recipient, emailDetails, userId);

  if (emailSent) {
    // Clear any previous bounce record on success
    await clearBounce(pool, recipient);
    
    if (template.id) {
      await trackTemplateUsage(template.id, userId, 'sent');
    }

    return {
      type: 'email_sent',
      message: `✅ ${type.charAt(0).toUpperCase() + type.slice(1)} email sent!\n\n📧 To: ${recipient}\n📝 Template: "${template.name}"`,
      data: { template_used: template.name, recipient, email_type: type },
      usage: usageData
    };
  } else {
    // Record the bounce
    await recordBounce(pool, recipient, 'soft', 'Send failed');
    
    return {
      type: 'error',
      message: `❌ Failed to send ${type} email to ${recipient}.\n\nPlease try again or check your email settings.`,
      usage: usageData
    };
  }
}

module.exports = {
  // Validation helpers
  validateTeam,
  validateEventType,
  validateTeamMember,
  formatMemberList,
  formatTeamList,
  formatEventTypeList,
  
  // Intent handlers
  handleGetMemberLink,
  handleGetEventType,
  handleScheduleTeamMeeting,
  handleCreateMeeting,
  handleSendEmail
};