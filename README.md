# dsh-auto-start

Cordis plugin cho DeepSeek Harness: tự chạy `npx @deepseek-ai/dsh web` khi đăng nhập máy (giống start-on-boot của 9router).

| OS | Entry được tạo |
|---|---|
| macOS | `~/Library/LaunchAgents/dsh.autostart.<label>.plist` (launchd, tự restart khi crash, log `~/Library/Logs/<label>.log`) |
| Linux | `~/.config/systemd/user/<label>.service` (systemd `--user`, `enable`) |
| Windows | `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\<label>.vbs` (chạy ẩn, log `%LOCALAPPDATA%\<label>.log`) |

## Cài

```sh
dsh plugin --profile web add github:tonamson/dsh-auto-start
dsh web   # chạy 1 lần: plugin ghi entry, từ lần login sau tự khởi động
```

Entry chỉ có hiệu lực từ lần đăng nhập kế tiếp; instance đang chạy không bị đụng tới. Muốn bật ngay trên macOS: tắt `dsh web` đang chạy rồi `launchctl load ~/Library/LaunchAgents/dsh.autostart.dsh-web.plist`.

## Config

Override trong `$DSH_HOME/profiles/web/cordis.patch.yml` (patch thay cả `config`, phải ghi đủ key cần đổi):

```yaml
- id: autostart
  config:
    enabled: true          # false: gỡ entry ở lần chạy kế
    label: dsh-web
    command: npx           # resolve thành đường dẫn tuyệt đối qua PATH lúc ghi
    args: ['-y', '@deepseek-ai/dsh', 'web', '--no-open']
```

`PATH` và `DSH_HOME` hiện tại được ghi vào entry (macOS/Linux) để process lúc login tìm được node/npx. Đổi version node (nvm) → chạy `dsh web` lại một lần để cập nhật entry.

API key: process lúc login không đọc shell rc, nên đặt `DEEPSEEK_API_KEY` trong `$DSH_HOME/.env` (hoặc cấu hình qua Settings trên web), không export trong `.zshrc`.

Linux: user service chỉ chạy khi user đăng nhập; muốn chạy ngay khi boot: `loginctl enable-linger $USER`.

## Gỡ

Đặt `enabled: false`, chạy `dsh web` một lần, rồi `dsh plugin --profile web remove dsh-auto-start`. Hoặc xóa file entry trong bảng trên.

## Test

```sh
npm install && npm test
```
