# Bentabet BSMS — Production Deployment Checklist

> Server: 168.231.78.121 | Frontend: bsms.betbenta.com | API: api.betbenta.com
> Deployment path: /opt/bsms

---

## SECURITY — Complete Before Going Live

- [x] **1. Rotate JWT secrets in `.env`** — generate fresh 64-char hex values
- [x] **2. Change default admin password** — login → Settings → My Profile
- [x] **3. Verify `.gitignore` includes**: `.env`, `node_modules/`
- [x] **4. Set `NODE_ENV=production` in backend `.env`** (this disables `alter: true`)
- [ ] **5. Configure MySQL user** — create app-specific user (not root):
  ```sql
  CREATE USER 'bentabet'@'localhost' IDENTIFIED BY 'your-strong-password';
  GRANT ALL ON bentabet_db.* TO 'bentabet'@'localhost';
  FLUSH PRIVILEGES;
  ```

## INFRASTRUCTURE — Provision VPS

- [x] **6. Provision server** — 168.231.78.121 (Hostinger VPS)
- [ ] **7. Hardening**
  - SSH key auth only (disable password login)
  - `ufw allow 22,80,443/tcp`
  - `fail2ban` for SSH
- [ ] **8. Install dependencies**
  ```bash
  apt update && apt upgrade -y
  apt install -y nginx mysql-server-8.0 certbot python3-certbot-nginx
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  apt install -y nodejs
  npm install -g pm2
  ```

## DNS (Completed)

- [x] **9. DNS A records configured**
  - `bsms.betbenta.com` → 168.231.78.121 (Frontend)
  - `api.betbenta.com` → 168.231.78.121 (API)

## DATABASE SETUP

- [ ] **10. Create database**
  ```bash
  mysql -u root -p -e "
    CREATE DATABASE bentabet_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    CREATE USER 'bentabet'@'localhost' IDENTIFIED BY 'your-strong-password';
    GRANT ALL ON bentabet_db.* TO 'bentabet'@'localhost';
    FLUSH PRIVILEGES;
  "
  ```
- [ ] **11. Enable binary logs** for point-in-time recovery (see BACKUP_GUIDE.md)
- [ ] **12. Setup automated backups** — add cron entries:
  ```cron
  0 2 * * * DB_PASSWORD=xxx /opt/bsms/backend/scripts/backup-db.sh daily
  0 3 * * * /opt/bsms/backend/scripts/backup-db.sh flush-logs
  ```

## APPLICATION DEPLOYMENT

- [ ] **13. Clone & install**
  ```bash
  git clone <your-github-repo-url> /opt/bsms
  cd /opt/bsms/backend && npm install --production
  cd /opt/bsms/frontend && npm install && npm run build
  ```
- [ ] **14. Create uploads directories**
  ```bash
  mkdir -p /opt/bsms/backend/uploads/{meters,receipts,documents,tickets,contracts,avatars,employees,meteora,novomatic}
  ```
- [ ] **15. Configure `.env`** — copy example, set all production values
  ```bash
  cd /opt/bsms/backend
  cp .env.example .env
  nano .env  # Fill in JWT secrets, DB password, Beem keys
  ```
- [ ] **16. Start with PM2**
  ```bash
  cd /opt/bsms/backend
  pm2 start ecosystem.config.js
  pm2 startup systemd   # Auto-start on reboot
  pm2 save
  ```
- [ ] **17. Configure nginx**
  ```bash
  cp /opt/bsms/deploy/nginx-bentabet.conf /etc/nginx/sites-available/bsms
  ln -sf /etc/nginx/sites-available/bsms /etc/nginx/sites-enabled/
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx
  ```
- [ ] **18. SSL certificates**
  ```bash
  certbot --nginx -d bsms.betbenta.com -d api.betbenta.com
  ```
- [ ] **19. Verify health**
  ```bash
  curl https://api.betbenta.com/health
  # Expected: {"status":"ok","timestamp":"..."}
  ```
- [ ] **20. Login** — admin@bentabet.co.tz / Admin@1234, then change password
- [ ] **21. Cashier flow** — Login as Cashier → Collections → Record Novomatic Collection → Submit
- [ ] **22. Manager flow** — Login as Operations Manager → View collections, approve
- [ ] **23. Mobile responsive** — Open on phone, verify menu works, check collections page
- [ ] **24. Dashboard loads** — Admin dashboard shows correct KPIs
- [ ] **25. Export works** — Collections export, assignments export
- [ ] **26. SMS service** — Test SMS from Settings → Notifications
- [ ] **27. Uploads serve** — Check meter images, receipts, documents load from /uploads/

## POST-LAUNCH MONITORING

- [ ] **28. Set uptime monitoring** — https://uptimerobot.com (free tier)
- [ ] **29. Check PM2 logs**
  ```bash
  pm2 logs bentabet-api --lines 50
  ```
- [ ] **30. Set off-site backup sync** — configure rclone + cron
- [ ] **31. Monitor disk usage**
  ```bash
  df -h / /opt/bsms/backups
  ```

## ROLLBACK PLAN

If something goes wrong after deployment:

```bash
# 1. Revert code
cd /opt/bsms && git reset --hard <previous-commit>

# 2. Rebuild frontend (if frontend changed)
cd /opt/bsms/frontend && npm run build

# 3. Restart app
pm2 restart all

# 4. If DB corrupted, restore from backup
DB_PASSWORD=xxx ./backend/scripts/backup-db.sh restore
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
tail -f /opt/bsms/backups/backup.log  # Backup logs
mysql -u bentabet -p             # Direct DB access

# Updates
cd /opt/bsms && git pull && cd backend && npm install --production && cd ../frontend && npm run build && pm2 restart all
```
