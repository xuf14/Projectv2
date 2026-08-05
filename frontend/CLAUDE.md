# CLAUDE.md — frontend

Quy tắc chung của cả dự án nằm ở `../CLAUDE.md` (nạp sẵn cùng file này). Đây chỉ là phần riêng của frontend.

## Ngăn xếp

- React 18 + Vite 5, **JSX thuần — không TypeScript**, npm.
- Dependency runtime chỉ gồm `react`, `react-dom`, `lucide-react`. Không có CSS framework, không có state library, không có router.

## Lệnh

- `npm install` · `npm run dev` (cổng 5173) · `npm run build` · `npm run preview`
- **Không có** script `lint` hay `typecheck`. Kiểm chứng thay đổi bằng `npm run build` và xem lại giao diện.

## Cấu trúc

- `App.jsx` — điều hướng bằng state, không dùng router: `TrangQuangBa.jsx` (trang công khai) → `StaffLanding` (chọn cổng) → `AuthScreen` → `ReceptionPortal` / `DoctorPortal` / `AdminPortal`.
- `shared.jsx` — hạ tầng dùng chung: bộ token màu `T`, component (`Btn`, `Card`, `Pill`, `Avatar`, `PortalShell`, `PageTitle`…), `store` (token giữ trong bộ nhớ, KHÔNG lưu localStorage), context `useNav` (`go`, `portal`, `departments`, `doctors`, `online`), và **toàn bộ hàm gọi API trong object `api`**.
- `quangba/` — các trang của website công khai (gồm `DangKyKham.jsx`).
- Các file nghiệp vụ ở gốc `src/`: `tiepnhan`, `quytrinhkham`, `phieu_dieu_tri`, `y_lenh`, `ravien`, `taikham`, `ivf_quy_trinh`, `dangky_online`, `thongtinbenhnhan`, `PatientsPage`…

## Quy ước khi viết giao diện

- Thêm endpoint mới → khai báo trong object `api` của `shared.jsx`, không gọi `fetch` rải rác trong component.
- Dùng token màu `T` và các component sẵn có; style là inline style, không thêm file CSS.
- Popup theo mẫu: overlay `position:fixed; inset:0; display:grid; placeItems:center` + `Card` chặn `stopPropagation` (xem `y_lenh.jsx`, `ravien.jsx`, `PatientsPage.jsx`).
- Mọi chữ hiển thị bằng **tiếng Việt**; xử lý đủ trạng thái loading / rỗng / lỗi.
- Ràng buộc nghiệp vụ luôn được chốt ở backend; giao diện chỉ phản ánh lại, không được coi việc khóa nút là biện pháp bảo vệ.
- API backend ở `http://localhost:3000/api` (hằng `API_BASE` trong `shared.jsx`); backend chỉ cho phép origin trong danh sách `CORS_ORIGINS` — chạy dev ở cổng khác 5173 thì phải thêm origin vào `.env` của backend.
