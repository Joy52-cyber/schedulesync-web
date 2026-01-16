# DNS Setup Guide for www.trucal.xyz → Railway

## Quick Setup

### Railway CNAME Target:
```
schedulesync-web-production.up.railway.app
```

---

## Setup by Provider:

### **Cloudflare** (Recommended)

1. Log in to Cloudflare
2. Select domain: `trucal.xyz`
3. Go to **DNS** → **Records**
4. Click **Add record**
5. Configure:
   - **Type:** CNAME
   - **Name:** `www`
   - **Target:** `schedulesync-web-production.up.railway.app`
   - **Proxy status:** **DNS only** (gray cloud ☁️, NOT orange 🟠)
   - **TTL:** Auto
6. Click **Save**

**Important:** Make sure the cloud is GRAY, not orange! Orange proxy will break Railway.

---

### **Namecheap**

1. Log in to Namecheap
2. Dashboard → Domain List → Manage
3. Click **Advanced DNS** tab
4. Click **Add New Record**
5. Configure:
   - **Type:** CNAME Record
   - **Host:** `www`
   - **Value:** `schedulesync-web-production.up.railway.app`
   - **TTL:** Automatic
6. Click **Save All Changes**

---

### **GoDaddy**

1. Log in to GoDaddy
2. My Products → DNS
3. Click **Add** (or **Add New Record**)
4. Configure:
   - **Type:** CNAME
   - **Name:** `www`
   - **Value:** `schedulesync-web-production.up.railway.app`
   - **TTL:** 1 Hour (or 3600 seconds)
5. Click **Save**

---

### **Google Domains / Squarespace**

1. Log in to your account
2. Go to DNS settings
3. Click **Manage custom records**
4. Click **Create new record**
5. Configure:
   - **Host name:** `www`
   - **Type:** CNAME
   - **TTL:** 1h (3600)
   - **Data:** `schedulesync-web-production.up.railway.app`
6. Click **Save**

---

### **Other Providers (Generic)**

Add a CNAME record with these values:
- **Type/Record Type:** CNAME
- **Name/Host/Subdomain:** `www`
- **Value/Target/Points to:** `schedulesync-web-production.up.railway.app`
- **TTL:** 3600 (or Auto)

---

## Verification

### Check DNS Propagation (5-60 minutes):

**Option 1: Command Line**
```bash
nslookup www.trucal.xyz
# Should show: www.trucal.xyz → schedulesync-web-production.up.railway.app
```

**Option 2: Online Tool**
Visit: https://dnschecker.org
- Enter: `www.trucal.xyz`
- Type: CNAME
- Should show your Railway domain

**Option 3: Railway Dashboard**
- Status will change from "Waiting for DNS update" to "Active"
- Green checkmark appears

---

## Troubleshooting

### Issue: "DNS not updating"
**Solution:**
- Make sure you saved the DNS record
- Wait 10-15 minutes for propagation
- Clear DNS cache: `ipconfig /flushdns` (Windows) or `sudo dscacheutil -flushcache` (Mac)

### Issue: Cloudflare - SSL/TLS errors
**Solution:**
- Set proxy to **DNS only** (gray cloud)
- OR set SSL/TLS mode to **Full** in Cloudflare

### Issue: "Still waiting after 1 hour"
**Solution:**
- Double-check the CNAME target is correct
- Remove any conflicting A or CNAME records for `www`
- Contact your DNS provider support

---

## Setting up Root Domain (Optional)

If you want `trucal.xyz` (without www) to also work:

### Cloudflare / Providers with ALIAS support:
Add an ALIAS record:
- **Type:** ALIAS (or ANAME)
- **Name:** `@`
- **Target:** `schedulesync-web-production.up.railway.app`

### Other Providers:
1. Add the www CNAME (above)
2. Set up URL forwarding:
   - Forward `trucal.xyz` → `www.trucal.xyz`
   - Type: 301 Permanent Redirect

---

## Final Checklist

- [ ] CNAME record created for `www`
- [ ] Target is `schedulesync-web-production.up.railway.app`
- [ ] DNS saved/published
- [ ] Waited 10-15 minutes
- [ ] Verified with nslookup or dnschecker.org
- [ ] Railway shows "Active" status
- [ ] Website accessible at www.trucal.xyz

---

## Need Help?

If stuck after following these steps, provide:
1. Your DNS provider name (Cloudflare, Namecheap, etc.)
2. Screenshot of your DNS records
3. Output of: `nslookup www.trucal.xyz`
