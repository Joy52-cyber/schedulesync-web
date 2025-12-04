/**
 * Email Validation Utility
 * 
 * Three-level validation:
 * 1. Format validation - Regex pattern check
 * 2. MX record check - Verify domain can receive emails
 * 3. Bounce tracking - Check historical bounces
 */

const dns = require('dns').promises;

// Common typo corrections for popular domains
const DOMAIN_TYPO_SUGGESTIONS = {
  'gmial.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'outlookcom': 'outlook.com',
  'yahooo.com': 'yahoo.com',
  'yaho.com': 'yahoo.com',
  'yahho.com': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'icoud.com': 'icloud.com',
  'iclod.com': 'icloud.com',
  'icloud.co': 'icloud.com',
};

// Known disposable email domains (partial list)
const DISPOSABLE_DOMAINS = [
  'tempmail.com', 'throwaway.com', 'mailinator.com', 'guerrillamail.com',
  'temp-mail.org', '10minutemail.com', 'fakeinbox.com', 'trashmail.com',
  'maildrop.cc', 'yopmail.com', 'sharklasers.com', 'spam4.me'
];

/**
 * Level 1: Format Validation
 * Checks if email matches valid format pattern
 */
function validateEmailFormat(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, reason: 'empty', message: 'Email address is required' };
  }

  const trimmedEmail = email.trim().toLowerCase();
  
  // Basic format check
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!emailRegex.test(trimmedEmail)) {
    return { valid: false, reason: 'invalid_format', message: `"${email}" is not a valid email format` };
  }

  // Check for double dots
  if (trimmedEmail.includes('..')) {
    return { valid: false, reason: 'invalid_format', message: 'Email cannot contain consecutive dots' };
  }

  // Extract domain
  const domain = trimmedEmail.split('@')[1];
  
  // Check for common typos
  if (DOMAIN_TYPO_SUGGESTIONS[domain]) {
    const suggestion = DOMAIN_TYPO_SUGGESTIONS[domain];
    const suggestedEmail = trimmedEmail.replace(domain, suggestion);
    return { 
      valid: false, 
      reason: 'typo_detected', 
      message: `Did you mean "${suggestedEmail}"?`,
      suggestion: suggestedEmail
    };
  }

  return { valid: true, email: trimmedEmail, domain };
}

/**
 * Level 2: MX Record Validation
 * Checks if domain has valid mail exchange records
 */
async function validateMXRecords(domain) {
  try {
    const mxRecords = await dns.resolveMx(domain);
    
    if (!mxRecords || mxRecords.length === 0) {
      return { 
        valid: false, 
        reason: 'no_mx_records', 
        message: `The domain "${domain}" cannot receive emails (no mail servers found)` 
      };
    }

    // Sort by priority and return
    const sortedMx = mxRecords.sort((a, b) => a.priority - b.priority);
    return { valid: true, mxRecords: sortedMx };
    
  } catch (error) {
    if (error.code === 'ENOTFOUND') {
      return { 
        valid: false, 
        reason: 'domain_not_found', 
        message: `The domain "${domain}" does not exist` 
      };
    }
    if (error.code === 'ENODATA') {
      return { 
        valid: false, 
        reason: 'no_mx_records', 
        message: `The domain "${domain}" has no mail servers configured` 
      };
    }
    // For other errors (timeout, etc.), we'll let it pass
    console.warn(`MX lookup warning for ${domain}:`, error.message);
    return { valid: true, warning: 'mx_lookup_failed' };
  }
}

/**
 * Level 3: Bounce History Check
 * Checks if email has bounced before
 */
async function checkBounceHistory(pool, email) {
  try {
    const result = await pool.query(
      `SELECT id, bounce_count, last_bounce_at, bounce_type 
       FROM email_bounces 
       WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length > 0) {
      const bounce = result.rows[0];
      
      // If bounced more than 2 times, block
      if (bounce.bounce_count >= 2) {
        return {
          valid: false,
          reason: 'repeated_bounces',
          message: `This email has bounced ${bounce.bounce_count} times. Please verify the address.`,
          bounceData: bounce
        };
      }
      
      // If hard bounce (permanent failure), block
      if (bounce.bounce_type === 'hard') {
        return {
          valid: false,
          reason: 'hard_bounce',
          message: 'This email address was permanently rejected. Please use a different address.',
          bounceData: bounce
        };
      }

      // Soft bounce - warn but allow
      return {
        valid: true,
        warning: 'previous_soft_bounce',
        message: 'This email had delivery issues before. Email may not be delivered.',
        bounceData: bounce
      };
    }

    return { valid: true };
  } catch (error) {
    console.error('Bounce check error:', error);
    // On error, allow the email (fail open)
    return { valid: true, warning: 'bounce_check_failed' };
  }
}

/**
 * Check if domain is disposable/temporary
 */
function isDisposableEmail(domain) {
  return DISPOSABLE_DOMAINS.includes(domain.toLowerCase());
}

/**
 * Record an email bounce
 */
async function recordBounce(pool, email, bounceType = 'soft', errorMessage = null) {
  try {
    await pool.query(
      `INSERT INTO email_bounces (email, bounce_type, bounce_count, last_bounce_at, error_message)
       VALUES ($1, $2, 1, NOW(), $3)
       ON CONFLICT (email) DO UPDATE SET
         bounce_count = email_bounces.bounce_count + 1,
         bounce_type = CASE 
           WHEN $2 = 'hard' THEN 'hard' 
           ELSE email_bounces.bounce_type 
         END,
         last_bounce_at = NOW(),
         error_message = COALESCE($3, email_bounces.error_message)`,
      [email.toLowerCase(), bounceType, errorMessage]
    );
    return true;
  } catch (error) {
    console.error('Failed to record bounce:', error);
    return false;
  }
}

/**
 * Clear bounce record (when email succeeds)
 */
async function clearBounce(pool, email) {
  try {
    await pool.query(
      `DELETE FROM email_bounces WHERE email = $1`,
      [email.toLowerCase()]
    );
    return true;
  } catch (error) {
    console.error('Failed to clear bounce:', error);
    return false;
  }
}

/**
 * Full Email Validation
 * Combines all three levels of validation
 */
async function validateEmail(email, pool = null, options = {}) {
  const {
    checkMX = true,
    checkBounces = true,
    allowDisposable = false,
    skipWarnings = false
  } = options;

  const result = {
    valid: true,
    email: null,
    warnings: [],
    errors: []
  };

  // Level 1: Format validation
  const formatResult = validateEmailFormat(email);
  if (!formatResult.valid) {
    return {
      valid: false,
      email: email,
      error: formatResult.message,
      reason: formatResult.reason,
      suggestion: formatResult.suggestion || null
    };
  }
  
  result.email = formatResult.email;
  const domain = formatResult.domain;

  // Check disposable domains
  if (!allowDisposable && isDisposableEmail(domain)) {
    return {
      valid: false,
      email: result.email,
      error: 'Temporary/disposable email addresses are not allowed',
      reason: 'disposable_email'
    };
  }

  // Level 2: MX Record validation
  if (checkMX) {
    const mxResult = await validateMXRecords(domain);
    if (!mxResult.valid) {
      return {
        valid: false,
        email: result.email,
        error: mxResult.message,
        reason: mxResult.reason
      };
    }
    if (mxResult.warning && !skipWarnings) {
      result.warnings.push(mxResult.warning);
    }
  }

  // Level 3: Bounce history check
  if (checkBounces && pool) {
    const bounceResult = await checkBounceHistory(pool, result.email);
    if (!bounceResult.valid) {
      return {
        valid: false,
        email: result.email,
        error: bounceResult.message,
        reason: bounceResult.reason,
        bounceData: bounceResult.bounceData
      };
    }
    if (bounceResult.warning && !skipWarnings) {
      result.warnings.push(bounceResult.warning);
      result.warningMessage = bounceResult.message;
    }
  }

  return result;
}

/**
 * Validate multiple emails at once
 */
async function validateEmails(emails, pool = null, options = {}) {
  const results = {
    valid: true,
    validEmails: [],
    invalidEmails: [],
    warnings: []
  };

  for (const email of emails) {
    const validation = await validateEmail(email, pool, options);
    
    if (validation.valid) {
      results.validEmails.push(validation.email);
      if (validation.warnings && validation.warnings.length > 0) {
        results.warnings.push({ email: validation.email, warnings: validation.warnings });
      }
    } else {
      results.valid = false;
      results.invalidEmails.push({
        email: email,
        error: validation.error,
        reason: validation.reason,
        suggestion: validation.suggestion
      });
    }
  }

  return results;
}

module.exports = {
  validateEmail,
  validateEmails,
  validateEmailFormat,
  validateMXRecords,
  checkBounceHistory,
  recordBounce,
  clearBounce,
  isDisposableEmail,
  DOMAIN_TYPO_SUGGESTIONS,
  DISPOSABLE_DOMAINS
};