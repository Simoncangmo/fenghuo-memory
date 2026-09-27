#!/usr/bin/env bash
# ============================================================
# 烽火记忆 · 服务器部署脚本（在新加坡轻量应用服务器上执行）
# 适用于：Ubuntu 22.04 / 24.04 系统镜像
# 流程：装 Node → 装 Nginx/PM2 → 拉代码 → npm install → PM2 守护
#       → Nginx 反代 80→3000 → 开机自启
# ============================================================
set -e

APP_DIR=/opt/fenghuo-memory
REPO=https://github.com/Simoncangmo/fenghuo-memory.git
PORT=3000
APP_USER=$USER

echo "==> [1/6] 更新系统并安装基础工具"
sudo apt-get update -y
sudo apt-get install -y curl git nginx

echo "==> [2/6] 安装 Node.js 22.x（匹配本地运行环境）"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "    Node 版本: $(node -v)  npm 版本: $(npm -v)"

echo "==> [3/6] 安装 PM2 进程守护"
sudo npm install -g pm2

echo "==> [4/6] 拉取代码并安装依赖"
sudo mkdir -p "$APP_DIR"
sudo chown -R "$APP_USER:$APP_USER" "$APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --rebase
else
  git clone "$REPO" "$APP_DIR"
fi
cd "$APP_DIR"
npm install --production

echo "==> [5/6] 用 PM2 启动应用（端口 $PORT）"
pm2 delete fenghuo-memory 2>/dev/null || true
pm2 start server.js --name fenghuo-memory --env production
pm2 save
sudo env PATH="$PATH:/usr/bin" /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u "$APP_USER" --hp "$HOME" || true

echo "==> [6/6] 配置 Nginx 反向代理 (80 -> $PORT)"
sudo tee /etc/nginx/sites-available/fenghuo-memory > /dev/null <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
sudo ln -sf /etc/nginx/sites-available/fenghuo-memory /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

echo ""
echo "============================================================"
echo " 部署完成！现在可通过浏览器访问:  http://<服务器公网IP>"
echo " 应用进程: pm2 status"
echo " 日志查看: pm2 logs fenghuo-memory"
echo "============================================================"
