# Bentabet Production Deployment Checklist

> Follow this checklist step-by-step before and during production launch.

---

## SECURITY — Complete Before Going Live

- [ ] **1. Rotate JWT secrets in `.env`** — generate fresh 64-char hex values
- [ ] **2. Change default admin password** — login → Settings → My Profile
- [ ] **3. Verify `.gitignore` includes**: `.env`, `node_modules/`
- [ ] **4. Set `NODE_ENV=production` in backend `.env`** (this disables `alter: true`)
- [ ] **5. Configure MySQL user** — create app-specific user (not root):
  ```sql
  CREATE USER 'bentabet'@'localhost' IDENTIFIED BY 'strong-password';
  GRANT ALL ON bentabet_db.* TO 'bentabet'@'localhost';
  ```

## INFRASTRUCTURE — Provision VPS

- [ ] **6. Provision server** (Ubuntu 22.04 LTS)
  - Hostinger VPS KVM 2 (2 CPU, 4GB RAM, 80GB NVMe SSD)
  - Alternative: DigitalOcean / Hetzner / AWS Lightsail with same specs
- [ ] **8. Hardening**
  - SSH key auth only (disable password login)
  - `ufw allow 22,80,443/tcp`
  - `fail2ban` for SSH
- [ ] **9. Install dependencies**
  ```bash
  apt update && apt upgrade -y
  apt install -y nginx mysql-server-8.0 certbot python3-certbot-nginx
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  apt install -y nodejs
  npm install -g pm2
  ```

## DATABASE SETUP

- [ ] **10. Create database**
  ```bash
  mysql -u root -p -e "
    CREATE DATABASE bentabet_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    CREATE USER 'bentabet'@'localhost' IDENTIFIED BY 'your-password';
    GRANT ALL ON bentabet_db.* TO 'bentabet'@'localhost';
    FLUSH PRIVILEGES;
  "
  ```
- [ ] **11. Enable binary logs** for point-in-time recovery (see BACKUP_GUIDE.md)
- [ ] **12. Setup automated backups** — add cron entries:
  ```cron
  0 2 * * * /opt/bentabet/backend/scripts/backup-db.sh daily
  0 3 * * * /opt/bentabet/backend/scripts/backup-db.sh flush-logs
  ```

## APPLICATION DEPLOYMENT

- [ ] **13. Clone & install**
  ```bash
  git clone https://github.com/your-org/bentabet-pos.git /opt/bentabet
  cd /opt/bentabet/backend && npm install --production
  cd /opt/bentabet/frontend && npm install && npm run build
  ```
- [ ] **14. Create uploads directories** — (photos, receipts, documents served via nginx, no Cloudinary)
  ```bash
  mkdir -p /opt/bentabet/backend/uploads/{meters,receipts,documents,tickets,contracts,avatars,employees,meteora,novomatic}
  ```
- [ ] **15. Configure `.env`** — copy example, set all production values
- [ ] **16. Start with PM2**
  ```bash
  cd /opt/bentabet/backend
  pm2 start ecosystem.config.js
  pm2 startup systemd   # Auto-start on reboot
  pm2 save
  ```
- [ ] **17. Configure nginx**
  ```bash
  cp /opt/bentabet/deploy/nginx-bentabet.conf /etc/nginx/sites-available/bentabet
  # Edit domain name in the file
  ln -s /etc/nginx/sites-available/bentabet /etc/nginx/sites-enabled/
  nginx -t && systemctl reload nginx
  ```
- [ ] **18. SSL certificate**
  ```bash
  certbot --nginx -d yourdomain.com
  ```
- [ ] **19. Verify health**
  ```bash
  curl https://yourdomain.com/health
  # Should return: {"status":"ok","timestamp":"..."}
  ```
- [ ] **20. Login** — admin@bentabet.co.tz works, token refresh works after 15min
- [ ] **20. Cashier flow** — Login as Cashier → Collections → Record Novomatic Collection → Submit
- [ ] **21. Manager flow** — Login as Operations Manager → View collections, approve
- [ ] **22. Mobile responsive** — Open on phone, verify menu works, check collections page
- [ ] **23. Dashboard loads** — Admin dashboard shows correct KPIs
- [ ] **24. Export works** — Collections export, assignments export
- [ ] **25. SMS service** — Test SMS from Settings → Notifications

## POST-LAUNCH MONITORING

- [ ] **26. Set uptime monitoring** — https://uptimerobot.com (free tier)
- [ ] **27. Check PM2 logs**
  ```bash
  pm2 logs bentabet-api --lines 50
  ```
- [ ] **28. Set off-site backup sync** — configure rclone + cron
- [ ] **29. Monitor disk usage**
  ```bash
  df -h / /backups
  ```
- [ ] **30. Test restore procedure** — restore backup to test DB

## ROLLBACK PLAN

If something goes wrong after deployment:

```bash
# 1. Revert code
cd /opt/bentabet && git reset --hard <previous-commit>

# 2. Restart app
pm2 restart all

# 3. If DB corrupted, restore from backup
./backend/scripts/backup-db.sh restore
```

---

## Quick Commands Reference

```bash
# App lifecycle
pm2 start ecosystem.config.js    # Start
pm2 restart all                  # Restart
pm2 stop all                     # Stop
pm2 logs                         # View logs
pm2 monit                        # Monitor CPU/memory

# Maintenance
journalctl -u nginx -f           # nginx logs
tail -f /backups/daily/backup.log  # Backup logs
mysql -u bentabet -p             # Direct DB access

# Updates
cd /opt/bentabet && git pull && npm install --production && npm run build && pm2 restart all
```
