import React, { useState } from "react";
import Layout from "./quangba/Layout";
import Home from "./quangba/Home";
import GioiThieu from "./quangba/GioiThieu";
import KhoaPhong from "./quangba/KhoaPhong";
import ViSaoChon from "./quangba/ViSaoChon";
import LienHe from "./quangba/LienHe";
import TinTuc from "./quangba/TinTuc";
import BaiViet from "./quangba/BaiViet";
import KhoaSan from "./quangba/KhoaSan";
import KhoaPhu from "./quangba/KhoaPhu";
import KhoaIVF from "./quangba/KhoaIVF";
import KhoaSoSinh from "./quangba/KhoaSoSinh";
import DangKyKham from "./quangba/DangKyKham";

// ============================================================================
//  TRANG QUẢNG BÁ (public) — cổng vào công khai đứng trước hệ thống nội bộ.
//  Router nhẹ theo state: mỗi mục trên menu là một trang con .jsx riêng
//  (Giới thiệu, Khoa phòng, Vì sao chọn, Tin tức, Liên hệ) + trang chủ và
//  trang đọc bài viết. Nút "Hệ thống nội bộ" gọi onEnter() để App chuyển sang
//  màn chọn cổng nhân viên.
// ============================================================================

export default function TrangQuangBa({ onEnter }) {
  // { name, params } — name là khóa trang, params dùng cho trang bài viết ({ id })
  const [route, setRoute] = useState({ name: "home", params: {} });

  const onNav = (name, params = {}) => {
    setRoute({ name, params });
    window.scrollTo(0, 0);
  };

  let page;
  switch (route.name) {
    case "gioi-thieu": page = <GioiThieu />; break;
    case "khoa-phong": page = <KhoaPhong onNav={onNav} />; break;
    case "khoa-san": page = <KhoaSan onBack={() => onNav("khoa-phong")} />; break;
    case "khoa-phu": page = <KhoaPhu onBack={() => onNav("khoa-phong")} onNav={onNav} />; break;
    case "khoa-ivf": page = <KhoaIVF onBack={() => onNav("khoa-phong")} onNav={onNav} />; break;
    case "khoa-so-sinh": page = <KhoaSoSinh onBack={() => onNav("khoa-phong")} onNav={onNav} />; break;
    case "vi-sao": page = <ViSaoChon />; break;
    case "dang-ky": page = <DangKyKham onNav={onNav} />; break;
    case "lien-he": page = <LienHe onEnter={onEnter} />; break;
    case "tin-tuc": page = <TinTuc onNav={onNav} />; break;
    case "bai-viet": page = <BaiViet id={route.params.id} onBack={() => onNav("tin-tuc")} />; break;
    default: page = <Home onNav={onNav} onEnter={onEnter} />;
  }

  // Mục menu đang active — trang bài viết thuộc nhánh Tin tức
  const active = route.name === "bai-viet" ? "tin-tuc"
    : ["khoa-san", "khoa-phu", "khoa-ivf", "khoa-so-sinh"].includes(route.name) ? "khoa-phong" : route.name;

  return (
    <Layout page={active} onNav={onNav} onEnter={onEnter}>
      {page}
    </Layout>
  );
}
