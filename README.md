# dsh-auto-start

Plugin cho [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh), giúp giao diện web `dsh web` **tự khởi động mỗi khi bật máy hoặc đăng nhập**, giống tính năng "start on boot" của 9router. Chạy được trên macOS, Linux và Windows.

## Plugin giải quyết vấn đề gì?

Bình thường, mỗi lần khởi động lại máy bạn phải mở terminal và gõ:

```sh
npx @deepseek-ai/dsh web
```

Quên chạy thì `http://localhost:3080` không vào được, và đóng terminal là server tắt luôn.

Khi cài plugin này:

- **dsh web tự chạy khi đăng nhập**, không cần mở terminal.
- **Chạy nền**, không hiện cửa sổ và không tự mở trình duyệt.
- **Tự khởi động lại khi crash** (macOS, Linux).
- **Không cần đăng nhập lại web**: cookie đăng nhập vẫn còn sau khi restart, cứ mở `http://localhost:3080` là dùng.

## Cách hoạt động

Lúc `dsh web` khởi động, plugin tạo (hoặc cập nhật) một mục khởi động của hệ điều hành:

| Hệ điều hành | Cơ chế | File được tạo |
|---|---|---|
| macOS | launchd LaunchAgent | `~/Library/LaunchAgents/dsh.autostart.dsh-web.plist` |
| Linux | systemd user service | `~/.config/systemd/user/dsh-web.service` |
| Windows | Thư mục Startup | `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\dsh-web.vbs` |

Mục này chạy `npx -y @deepseek-ai/dsh web --no-open` ở mỗi lần đăng nhập. Plugin không khởi động thêm instance nào trong lúc bạn đang chạy dsh, nên không bị tranh cổng.

## Yêu cầu

- DeepSeek Harness **0.2.0-rc trở lên** (có trang **Plugins** trong giao diện web).
- Node.js và `npx` có trong `PATH`.
- API key được lưu trong dsh, tức là nhập qua **Settings → Models** hoặc ghi vào `$DSH_HOME/.env` (mặc định `~/.dsh/.env`). Lúc đăng nhập máy, process không đọc `.zshrc`/`.bashrc`, nên key chỉ `export` trong shell sẽ không có tác dụng.

## Cài đặt

### Cách 1: qua giao diện web (khuyên dùng)

1. Chạy dsh web như bình thường: `npx @deepseek-ai/dsh web`.
2. Mở trang **Plugins** rồi bấm **Add plugin** → **Install a third-party plugin**.
3. Dán link repo vào ô **Package name or address**:
   ```
   https://github.com/tonamson/dsh-auto-start
   ```
4. Bấm **Install**. Cài xong thì bấm **Enable now**. Plugin cài xong mặc định đang tắt, phải bật mới chạy.
5. **Tắt dsh web (Ctrl+C) rồi chạy lại một lần.** Thay đổi plugin chỉ có hiệu lực từ lần khởi động sau. Lần chạy này plugin sẽ ghi mục khởi động.

Từ lần đăng nhập sau, dsh web tự chạy.

### Cách 2: qua dòng lệnh

```sh
npx @deepseek-ai/dsh plugin --profile web add github:tonamson/dsh-auto-start
npx @deepseek-ai/dsh web   # chạy 1 lần để plugin ghi mục khởi động
```

## Kiểm tra plugin đã hoạt động

Sau bước cài đặt, log của dsh web có dòng `installed login entry ...`. Có thể tự kiểm tra thêm:

**macOS**
```sh
ls ~/Library/LaunchAgents/dsh.autostart.dsh-web.plist
```

**Linux**
```sh
systemctl --user is-enabled dsh-web.service   # in ra: enabled
```

**Windows** (PowerShell)
```powershell
dir "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\dsh-web.vbs"
```

Kiểm tra cuối cùng: khởi động lại máy, đăng nhập, rồi mở `http://localhost:3080`.

## Bật ngay, không cần khởi động lại máy

Tắt dsh web đang chạy trong terminal trước, rồi chạy:

| Hệ điều hành | Lệnh |
|---|---|
| macOS | `launchctl load ~/Library/LaunchAgents/dsh.autostart.dsh-web.plist` |
| Linux | `systemctl --user start dsh-web.service` |
| Windows | Nhấp đúp file `dsh-web.vbs` trong thư mục Startup |

## Cấu hình

Mặc định không cần chỉnh gì. Muốn đổi thì vào **Plugins → dsh-auto-start → Configure**, hoặc sửa file `$DSH_HOME/profiles/web/cordis.patch.yml`:

```yaml
- id: autostart
  config:
    enabled: true
    label: dsh-web
    command: npx
    args: ['-y', '@deepseek-ai/dsh', 'web', '--no-open']
```

| Trường | Mặc định | Ý nghĩa |
|---|---|---|
| `enabled` | `true` | `false` thì lần khởi động sau plugin **xóa** mục khởi động |
| `label` | `dsh-web` | Tên mục khởi động (tên file plist/service/vbs) |
| `command` | `npx` | Lệnh để chạy; được đổi thành đường dẫn tuyệt đối lúc ghi |
| `args` | `-y @deepseek-ai/dsh web --no-open` | Tham số đi kèm lệnh |
| `cwd` | thư mục home | Thư mục làm việc của process |

Ví dụ đổi cổng sang 8080: `args: ['-y', '@deepseek-ai/dsh', 'web', '--no-open', '--port', '8080']`.

Sửa xong thì chạy lại dsh web một lần để mục khởi động được cập nhật.

## Gỡ cài đặt

Gỡ plugin **không** tự xóa mục khởi động, nên phải làm theo thứ tự:

1. Đặt `enabled: false` (trong **Configure** hoặc `cordis.patch.yml`), rồi chạy lại dsh web một lần. Log có dòng `removed login entry ...`.
2. Vào **Plugins → dsh-auto-start → Uninstall**, hoặc chạy `npx @deepseek-ai/dsh plugin --profile web remove dsh-auto-start`.

Nếu đã gỡ plugin trước, xóa tay mục khởi động:

```sh
# macOS
launchctl unload ~/Library/LaunchAgents/dsh.autostart.dsh-web.plist
rm ~/Library/LaunchAgents/dsh.autostart.dsh-web.plist

# Linux
systemctl --user disable --now dsh-web.service
rm ~/.config/systemd/user/dsh-web.service
```

Windows: xóa file `dsh-web.vbs` trong thư mục Startup.

## Cập nhật plugin

dsh hiện chưa tự cập nhật plugin. Muốn lên bản mới thì **Uninstall** rồi **Add plugin** lại với cùng link.

## Xử lý sự cố

| Triệu chứng | Cách xử lý |
|---|---|
| Đăng nhập xong không vào được `localhost:3080` | Xem log: macOS `~/Library/Logs/dsh-web.log`, Linux `journalctl --user -u dsh-web`, Windows `%LOCALAPPDATA%\dsh-web.log` |
| Log báo lỗi API key | Lưu key qua **Settings → Models** hoặc `$DSH_HOME/.env`, không chỉ `export` trong shell |
| Đổi version Node (nvm, fnm…) xong thì không chạy nữa | Chạy lại dsh web một lần để plugin ghi lại đường dẫn `npx` mới |
| Lỗi `command "npx" not found on PATH` | Cài Node.js, hoặc đặt `command` là đường dẫn tuyệt đối tới `npx` |
| Linux: chỉ chạy sau khi đăng nhập, không chạy lúc vừa boot | `loginctl enable-linger $USER` |
| Cổng 3080 bị chiếm | Instance từ autostart đang chạy, bạn không cần chạy thêm. Hoặc dừng nó bằng lệnh ở phần [Gỡ cài đặt](#gỡ-cài-đặt) |

## Phát triển

```sh
npm install
npm test
```

`entry.js` sinh nội dung file khởi động cho từng hệ điều hành và có unit test. `index.js` là Cordis plugin đọc config, rồi ghi hoặc xóa file khởi động.

## License

MIT
