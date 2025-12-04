/**
 * AI Assistant Route Integration Example
 * 
 * Shows how to integrate the validated handlers into your main AI assistant route
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Import validated handlers
const {
  handleGetMemberLink,
  handleGetEventType,
  handleScheduleTeamMeeting,
  handleCreateMeeting,
  handleSendEmail
} = require('./ai-assistant-handlers');

// Import email validator for direct use
const { validateEmail, recordBounce } = require('../utils/emailValidator');

// Import your existing helpers
// const { selectBestTemplate, sendEmailWithTemplate, trackTemplateUsage } = require('../utils/emailHelpers');

router.post('/chat', async (req, res) => {
  const userId = req.user.id;
  const { message } = req.body;
  
  try {
    // ... your existing intent parsing logic ...
    const parsedIntent = await parseIntent(message); // Your function
    const usageData = { /* your usage tracking */ };

    // ============ ROUTE TO VALIDATED HANDLERS ============

    // Handle get member link
    if (parsedIntent.intent === 'get_member_link') {
      const response = await handleGetMemberLink(pool, userId, parsedIntent, usageData);
      return res.json(response);
    }

    // Handle get event type
    if (parsedIntent.intent === 'get_event_type') {
      const response = await handleGetEventType(pool, userId, parsedIntent, usageData);
      return res.json(response);
    }

    // Handle schedule team meeting
    if (parsedIntent.intent === 'schedule_team_meeting') {
      const response = await handleScheduleTeamMeeting(pool, userId, parsedIntent, usageData);
      return res.json(response);
    }

    // Handle create meeting
    if (parsedIntent.intent === 'create_meeting') {
      const response = await handleCreateMeeting(pool, userId, parsedIntent, usageData);
      return res.json(response);
    }

    // Handle send email
    if (parsedIntent.intent === 'send_email' && parsedIntent.email_action) {
      const helpers = {
        selectBestTemplate,      // Your function
        sendEmailWithTemplate,   // Your function  
        trackTemplateUsage       // Your function
      };
      const response = await handleSendEmail(pool, userId, parsedIntent, usageData, helpers);
      return res.json(response);
    }

    // ... rest of your handlers ...

  } catch (error) {
    console.error('AI Assistant error:', error);
    return res.json({
      type: 'error',
      message: '❌ Something went wrong. Please try again.'
    });
  }
});

// ============ WEBHOOK FOR EMAIL BOUNCES ============
// If using a service like Resend, SendGrid, etc., set up bounce webhooks

router.post('/webhooks/email-bounce', async (req, res) => {
  try {
    const { type, email, error } = req.body;
    
    // Determine bounce type
    const bounceType = ['hard_bounce', 'invalid', 'unknown_user'].includes(type) 
      ? 'hard' 
      : 'soft';
    
    // Record the bounce
    await recordBounce(pool, email, bounceType, error);
    
    console.log(`Recorded ${bounceType} bounce for ${email}`);
    res.status(200).json({ received: true });
    
  } catch (error) {
    console.error('Bounce webhook error:', error);
    res.status(500).json({ error: 'Failed to process bounce' });
  }
});

module.exports = router;


// ============ RESEND WEBHOOK EXAMPLE ============
/*
If using Resend, the webhook payload looks like:

{
  "type": "email.bounced",
  "data": {
    "email_id": "...",
    "to": ["john@example.com"],
    "bounce": {
      "message": "The email account does not exist"
    }
  }
}

router.post('/webhooks/resend', async (req, res) => {
  const { type, data } = req.body;
  
  if (type === 'email.bounced') {
    const email = data.to[0];
    const bounceType = data.bounce?.message?.includes('does not exist') ? 'hard' : 'soft';
    await recordBounce(pool, email, bounceType, data.bounce?.message);
  }
  
  res.status(200).json({ received: true });
});
*/


// ============ SENDGRID WEBHOOK EXAMPLE ============
/*
If using SendGrid, the webhook payload looks like:

[{
  "event": "bounce",
  "email": "john@example.com",
  "type": "bounce",
  "bounce_classification": "Invalid Address"
}]

router.post('/webhooks/sendgrid', async (req, res) => {
  const events = req.body;
  
  for (const event of events) {
    if (event.event === 'bounce') {
      const bounceType = event.bounce_classification === 'Invalid Address' ? 'hard' : 'soft';
      await recordBounce(pool, event.email, bounceType, event.bounce_classification);
    }
  }
  
  res.status(200).json({ received: true });
});
*/