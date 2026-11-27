import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  onSnapshot 
} from 'firebase/firestore';

// --- CẤU HÌNH FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyD-placeholder-key-for-serenade-order",
  authDomain: "serenade-order.firebaseapp.com",
  projectId: "serenade-order",
  storageBucket: "serenade-order.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

// --- TẢI THƯ VIỆN BARCODE & QR CHUẨN QUỐC TẾ TỪ CDN ---
const loadExternalScripts = () => {
  if (document.getElementById('external-barcode-js')) return;
  
  const scriptJsBarcode = document.createElement('script');
  scriptJsBarcode.id = 'external-barcode-js';
  scriptJsBarcode.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js';
  document.head.appendChild(scriptJsBarcode);

  const scriptQr = document.createElement('script');
  scriptQr.id = 'external-qr-js';
  scriptQr.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';
  document.head.appendChild(scriptQr);
};

// --- GIAO DIỆN CHÍNH ---
export default function App() {
  const [user, setUser] = useState<{ username: string; role: 'admin' | 'ctv'; name: string } | null>(null);
  const [tab, setTab] = useState<'orders' | 'tracking' | 'print' | 'ctv' | 'tax' | 'ready'>('orders');
  
  // Dữ liệu Cloud Firestore
  const [orders, setOrders] = useState<any[]>([]);
  const [ctvs, setCtvs] = useState<any[]>([]);
  const [readyItems, setReadyItems] = useState<any[]>([]);
  
  // Trạng thái Form & Bộ lọc
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingFilter, setPendingFilter] = useState<'all' | 'cho_dat' | 'da_dat' | 'xuat_kho' | 'co_san'>('all');
  const [taxSkipPersonal, setTaxSkipPersonal] = useState(true);

  // Form thêm đơn mới
  const [newOrder, setNewOrder] = useState({
    ctvName: 'MOON',
    customerName: '',
    phone: '',
    address: '',
    itemsText: '',
    chinaLink: '',
    cnTracking: '',
    price: '',
    deposit: '',
    shippingFee: '16000',
    note: ''
  });

  // Modal Báo Giao Hàng của CTV
  const [deliveryModalOrder, setDeliveryModalOrder] = useState<any>(null);
  const [deliveryData, setDeliveryData] = useState({ phone: '', address: '', extraPay: '', billImage: '' });

  // Modal Chốt Đơn Hàng Sẵn của CTV
  const [readyBuyModalItem, setReadyBuyModalItem] = useState<any>(null);
  const [readyBuyData, setReadyBuyData] = useState({
    customerName: '',
    phone: '',
    address: '',
    commission: '',
    payType: 'cod', // cod, deposit, bank_full
    depositAmount: '',
    billImage: ''
  });

  // Modal Thêm/Sửa Hàng Sẵn (Admin)
  const [readyItemModalOpen, setReadyItemModalOpen] = useState(false);
  const [editingReadyItem, setEditingReadyItem] = useState<any>(null);
  const [readyForm, setReadyForm] = useState({
    name: '',
    specs: '',
    stock: '1',
    costPrice: '',
    sellPrice: '',
    images: ['', '', '', '']
  });

  useEffect(() => {
    loadExternalScripts();

    // Lắng nghe dữ liệu realtime từ Firebase
    const unsubOrders = onSnapshot(doc(db, "serenade_data", "orders_db"), (docSnap) => {
      if (docSnap.exists()) setOrders(docSnap.data().list || []);
    });

    const unsubCtvs = onSnapshot(doc(db, "serenade_data", "ctvs_db"), (docSnap) => {
      if (docSnap.exists()) setCtvs(docSnap.data().list || []);
    });

    const unsubReady = onSnapshot(doc(db, "serenade_data", "ready_items_db"), (docSnap) => {
      if (docSnap.exists()) setReadyItems(docSnap.data().list || []);
    });

    return () => {
      unsubOrders();
      unsubCtvs();
      unsubReady();
    };
  }, []);

  // Hàm lưu dữ liệu lên Firebase
  const saveOrdersToFirebase = async (newList: any[]) => {
    await setDoc(doc(db, "serenade_data", "orders_db"), { list: newList });
  };

  const saveCtvsToFirebase = async (newList: any[]) => {
    await setDoc(doc(db, "serenade_data", "ctvs_db"), { list: newList });
  };

  const saveReadyToFirebase = async (newList: any[]) => {
    await setDoc(doc(db, "serenade_data", "ready_items_db"), { list: newList });
  };

  // Upload ảnh lên Cloudinary
  const uploadToCloudinary = async (file: File, isHighRes = false): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'ml_default');
    try {
      const res = await fetch('https://api.cloudinary.com/v1_1/demo/image/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      return data.secure_url || URL.createObjectURL(file);
    } catch {
      return URL.createObjectURL(file);
    }
  };

  // --- MÀN HÌNH ĐĂNG NHẬP ---
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-pink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 border border-orange-100">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-orange-500 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-orange-500/30 text-white text-3xl font-bold mb-3">
              📦
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Serenade Order</h1>
            <p className="text-sm text-gray-500 mt-1">Hệ thống quản lý đơn hàng & kho hàng</p>
          </div>

          <form onSubmit={(e) => {
            e.preventDefault();
            const u = (e.currentTarget.elements.namedItem('username') as HTMLInputElement).value.trim();
            const p = (e.currentTarget.elements.namedItem('password') as HTMLInputElement).value.trim();
            
            if (u === 'admin' && p === 'admin123') {
              setUser({ username: 'admin', role: 'admin', name: 'Admin Tổng' });
            } else {
              const found = ctvs.find(c => c.username === u && c.pass === p);
              if (found) {
                setUser({ username: found.username, role: 'ctv', name: found.name });
              } else {
                alert('Sai tên đăng nhập hoặc mật khẩu!');
              }
            }
          }} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">TÊN ĐĂNG NHẬP</label>
              <input name="username" required className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" placeholder="Nhập tên đăng nhập..." />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">MẬT KHẨU</label>
              <input name="password" type="password" required className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" placeholder="Nhập mật khẩu..." />
            </div>
            <button type="submit" className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold shadow-lg shadow-orange-500/30 transition-all text-sm">
              Đăng Nhập Hệ Thống
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 pb-12">
      {/* HEADER */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md">
            📦
          </div>
          <div>
            <h1 className="font-bold text-gray-800 text-sm md:text-base leading-tight">Serenade Order</h1>
            <span className="text-xs text-emerald-600 font-medium">● Trực tuyến (Kho 25GB)</span>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-xs md:text-sm font-semibold bg-orange-50 text-orange-600 px-3 py-1 rounded-full border border-orange-200">
            {user.name} ({user.role.toUpperCase()})
          </span>
          <button onClick={() => setUser(null)} className="text-xs text-red-500 hover:text-red-700 font-bold px-3 py-1 bg-red-50 rounded-lg border border-red-100">
            Thoát
          </button>
        </div>
      </header>

      {/* NAVIGATION TABS */}
      <div className="bg-white border-b border-gray-200 px-4 flex overflow-x-auto space-x-6 text-sm font-semibold text-gray-600 scrollbar-none">
        <button onClick={() => setTab('orders')} className={`py-3.5 border-b-2 whitespace-nowrap transition-all ${tab === 'orders' ? 'border-orange-500 text-orange-600' : 'border-transparent hover:text-gray-900'}`}>
          📦 1. Đơn Hàng & Theo Dõi
        </button>
        <button onClick={() => setTab('ready')} className={`py-3.5 border-b-2 whitespace-nowrap transition-all ${tab === 'ready' ? 'border-orange-500 text-orange-600' : 'border-transparent hover:text-gray-900'}`}>
          🏷️ 2. Kho Hàng Sẵn
        </button>
        <button onClick={() => setTab('tracking')} className={`py-3.5 border-b-2 whitespace-nowrap transition-all ${tab === 'tracking' ? 'border-orange-500 text-orange-600' : 'border-transparent hover:text-gray-900'}`}>
          🚚 3. Tracking & Đợt Kho
        </button>
        {user.role === 'admin' && (
          <>
            <button onClick={() => setTab('print')} className={`py-3.5 border-b-2 whitespace-nowrap transition-all ${tab === 'print' ? 'border-orange-500 text-orange-600' : 'border-transparent hover:text-gray-900'}`}>
              🖨️ 4. Tạo Đơn Trả Hàng & A6
            </button>
            <button onClick={() => setTab('ctv')} className={`py-3.5 border-b-2 whitespace-nowrap transition-all ${tab === 'ctv' ? 'border-orange-500 text-orange-600' : 'border-transparent hover:text-gray-900'}`}>
              👥 5. CTV & Hoa Hồng
            </button>
            <button onClick={() => setTab('tax')} className={`py-3.5 border-b-2 whitespace-nowrap transition-all ${tab === 'tax' ? 'border-orange-500 text-orange-600' : 'border-transparent hover:text-gray-900'}`}>
              📊 6. Báo Cáo & Thuế
            </button>
          </>
        )}
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* ================= TAB 1: ĐƠN HÀNG & THEO DÕI ================= */}
        {tab === 'orders' && (
          <div className="space-y-6">
            {/* FORM TẠO ĐƠN */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center">
                <span className="w-2 h-6 bg-orange-500 rounded-full mr-2"></span>
                Tạo Đơn Hàng Mới
              </h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const newId = orders.length > 0 ? Math.max(...orders.map(o => o.id)) + 1 : 2601;
                const orderItem = {
                  id: newId,
                  ...newOrder,
                  status: 'Chờ đặt hàng', // Chờ đặt hàng, Đã đặt hàng, Xuất kho, Có sẵn, Đã trả hàng
                  createdAt: new Date().toLocaleDateString('vi-VN'),
                  cnTracking: newOrder.cnTracking || 'Chưa có',
                  spxTracking: '',
                  costPrice: 0,
                  deliveryInfo: null,
                  extraBill: ''
                };
                const updated = [orderItem, ...orders];
                setOrders(updated);
                await saveOrdersToFirebase(updated);
                setNewOrder({
                  ctvName: user.role === 'ctv' ? user.name : 'MOON',
                  customerName: '', phone: '', address: '', itemsText: '', chinaLink: '', cnTracking: '', price: '', deposit: '', shippingFee: '16000', note: ''
                });
                alert(`Tạo đơn #${newId} thành công!`);
              }} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {user.role === 'admin' ? (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">CTV ĐẶT ĐƠN</label>
                    <select value={newOrder.ctvName} onChange={e => setNewOrder({...newOrder, ctvName: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm">
                      {ctvs.map(c => <option key={c.username} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">CTV</label>
                    <input disabled value={user.name} className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold" />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">TÊN KHÁCH HÀNG</label>
                  <input required value={newOrder.customerName} onChange={e => setNewOrder({...newOrder, customerName: e.target.value})} placeholder="VD: Lan Anh" className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">SỐ ĐIỆN THOẠI</label>
                  <input required value={newOrder.phone} onChange={e => setNewOrder({...newOrder, phone: e.target.value})} placeholder="VD: 0912345678" className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">ĐỊA CHỈ NHẬN HÀNG</label>
                  <input required value={newOrder.address} onChange={e => setNewOrder({...newOrder, address: e.target.value})} placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành..." className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">MÃ VẬN ĐƠN TRUNG QUỐC (NẾU CÓ)</label>
                  <input value={newOrder.cnTracking} onChange={e => setNewOrder({...newOrder, cnTracking: e.target.value})} placeholder="VD: SF123456789" className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">THÔNG TIN SẢN PHẨM & MÔ TẢ</label>
                  <textarea required rows={2} value={newOrder.itemsText} onChange={e => setNewOrder({...newOrder, itemsText: e.target.value})} placeholder="VD: 1. Áo sơ mi trắng size M - 150k..." className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"></textarea>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">LINK TAOBAO / 1688 / PINDUODUO</label>
                  <input value={newOrder.chinaLink} onChange={e => setNewOrder({...newOrder, chinaLink: e.target.value})} placeholder="https://item.taobao.com/..." className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">GIÁ BÁN (VNĐ)</label>
                    <input type="number" required value={newOrder.price} onChange={e => setNewOrder({...newOrder, price: e.target.value})} placeholder="250000" className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">ĐÃ CỌC (VNĐ)</label>
                    <input type="number" required value={newOrder.deposit} onChange={e => setNewOrder({...newOrder, deposit: e.target.value})} placeholder="100000" className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">PHÍ SHIP (VNĐ)</label>
                    <input type="number" value={newOrder.shippingFee} onChange={e => setNewOrder({...newOrder, shippingFee: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">GHI CHÚ (NẾU CÓ)</label>
                  <input value={newOrder.note} onChange={e => setNewOrder({...newOrder, note: e.target.value})} placeholder="Lấy cái đẹp, kiểm kỹ..." className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
                </div>
                <div className="md:col-span-3 flex justify-end mt-2">
                  <button type="submit" className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-md text-sm transition-all">
                    + Tạo Đơn Hàng Ngay
                  </button>
                </div>
              </form>
            </div>

            {/* DANH SÁCH ĐƠN HÀNG & BỘ LỌC */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <h2 className="text-base font-bold text-gray-800">Danh Sách Đơn Hàng</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Tìm mã đơn, tên khách, SĐT..." className="px-4 py-2 rounded-xl border border-gray-200 text-sm w-full md:w-64" />
                </div>
              </div>

              {/* BỘ LỌC NHANH TRẠNG THÁI */}
              <div className="flex items-center space-x-2 overflow-x-auto pb-3 mb-4 scrollbar-none">
                {[
                  { key: 'all', label: 'Tất cả', count: orders.length },
                  { key: 'cho_dat', label: 'Chờ đặt hàng', count: orders.filter(o => o.status === 'Chờ đặt hàng').length },
                  { key: 'da_dat', label: 'Đã đặt hàng', count: orders.filter(o => o.status === 'Đã đặt hàng').length },
                  { key: 'xuat_kho', label: 'Xuất kho', count: orders.filter(o => o.status === 'Xuất kho').length },
                  { key: 'co_san', label: 'Có sẵn', count: orders.filter(o => o.status === 'Có sẵn').length },
                ].map(tabF => (
                  <button key={tabF.key} onClick={() => setPendingFilter(tabF.key as any)} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${pendingFilter === tabF.key ? 'bg-orange-500 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {tabF.label} ({tabF.count})
                  </button>
                ))}
              </div>

              {/* DANH SÁCH CARD ĐƠN */}
              <div className="space-y-4">
                {orders
                  .filter(o => user.role === 'admin' || o.ctvName === user.name)
                  .filter(o => pendingFilter === 'all' || 
                    (pendingFilter === 'cho_dat' && o.status === 'Chờ đặt hàng') ||
                    (pendingFilter === 'da_dat' && o.status === 'Đã đặt hàng') ||
                    (pendingFilter === 'xuat_kho' && o.status === 'Xuất kho') ||
                    (pendingFilter === 'co_san' && o.status === 'Có sẵn')
                  )
                  .filter(o => !searchTerm || o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || o.phone.includes(searchTerm) || String(o.id).includes(searchTerm) || (o.cnTracking && o.cnTracking.toLowerCase().includes(searchTerm.toLowerCase())))
                  .map(ord => {
                    const price = Number(ord.price) || 0;
                    const deposit = Number(ord.deposit) || 0;
                    const ship = Number(ord.shippingFee) || 0;
                    const extra = ord.deliveryInfo ? Number(ord.deliveryInfo.extraPay) || 0 : 0;
                    const cod = Math.max(0, price + ship - deposit - extra);

                    return (
                      <div key={ord.id} className="border border-gray-200 rounded-2xl p-4 hover:shadow-md transition-all bg-white relative">
                        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-100 pb-3 mb-3 gap-2">
                          <div className="flex items-center space-x-3">
                            <span className="font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-xl text-sm border border-orange-200">#{ord.id}</span>
                            <span className="text-xs text-gray-500 font-medium">{ord.createdAt}</span>
                            <span className="text-xs bg-purple-50 text-purple-700 font-semibold px-2.5 py-1 rounded-lg border border-purple-200">{ord.ctvName}</span>
                            <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                              ord.status === 'Đã trả hàng' ? 'bg-emerald-100 text-emerald-800' :
                              ord.status === 'Có sẵn' ? 'bg-blue-100 text-blue-800' :
                              ord.status === 'Xuất kho' ? 'bg-indigo-100 text-indigo-800' :
                              ord.status === 'Đã đặt hàng' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-800'
                            }`}>{ord.status}</span>
                          </div>
                          {user.role === 'admin' && (
                            <div className="flex items-center space-x-2">
                              <select value={ord.status} onChange={async (e) => {
                                const updated = orders.map(x => x.id === ord.id ? {...x, status: e.target.value} : x);
                                setOrders(updated);
                                await saveOrdersToFirebase(updated);
                              }} className="text-xs font-semibold bg-gray-50 border border-gray-200 px-2 py-1.5 rounded-lg">
                                <option value="Chờ đặt hàng">Chờ đặt hàng</option>
                                <option value="Đã đặt hàng">Đã đặt hàng</option>
                                <option value="Xuất kho">Xuất kho</option>
                                <option value="Có sẵn">Có sẵn</option>
                                <option value="Đã trả hàng">Đã trả hàng</option>
                              </select>
                              <button onClick={async () => {
                                if (confirm(`Xóa đơn #${ord.id}?`)) {
                                  const updated = orders.filter(x => x.id !== ord.id);
                                  setOrders(updated);
                                  await saveOrdersToFirebase(updated);
                                }
                              }} className="text-red-500 hover:text-red-700 p-1">🗑️</button>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="font-bold text-gray-800 text-base">{ord.customerName} — <span className="text-orange-600 font-semibold">{ord.phone}</span></p>
                            <p className="text-xs text-gray-600 mt-1">📍 {ord.address}</p>
                            {ord.cnTracking && <p className="text-xs text-indigo-600 font-medium mt-1">📦 MVĐ TQ: {ord.cnTracking}</p>}
                            {ord.spxTracking && <p className="text-xs text-emerald-600 font-medium mt-1">🚀 MVĐ SPX: {ord.spxTracking}</p>}
                          </div>
                          <div className="md:col-span-2 bg-gray-50 rounded-xl p-3 border border-gray-100">
                            <p className="font-medium text-gray-800 text-sm whitespace-pre-line">{ord.itemsText}</p>
                            {ord.chinaLink && <a href={ord.chinaLink} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline block mt-1 truncate">🔗 {ord.chinaLink}</a>}
                            {ord.note && <p className="text-xs text-rose-600 font-medium mt-1">💡 Ghi chú: {ord.note}</p>}
                            <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-gray-200 text-xs font-semibold">
                              <span>Giá: <strong className="text-gray-900">{price.toLocaleString()} ₫</strong></span>
                              <span>Cọc: <strong className="text-emerald-600">{deposit.toLocaleString()} ₫</strong></span>
                              {extra > 0 && <span className="text-indigo-600">Khách trả thêm: +{extra.toLocaleString()} ₫</span>}
                              <span>COD còn: <strong className="text-rose-600 text-sm">{cod.toLocaleString()} ₫</strong></span>
                            </div>
                            {ord.deliveryInfo && (
                              <div className="mt-2 text-xs bg-emerald-50 text-emerald-800 p-2 rounded-lg border border-emerald-200 flex items-center justify-between">
                                <span>✅ Đã báo giao hàng {ord.deliveryInfo.time} ({ord.deliveryInfo.phone})</span>
                                {ord.deliveryInfo.billImage && <a href={ord.deliveryInfo.billImage} target="_blank" rel="noreferrer" className="text-blue-600 underline font-bold">Xem Bill Chuyển Khoản</a>}
                              </div>
                            )}
                            {ord.extraBill && (
                              <div className="mt-1 text-xs">
                                <a href={ord.extraBill} target="_blank" rel="noreferrer" className="text-blue-600 underline font-bold">📄 Xem Bill Cọc/Thanh Toán Khác</a>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* NÚT BÁO GIAO HÀNG CHO CTV */}
                        {ord.status !== 'Đã trả hàng' && (
                          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end">
                            <button onClick={() => {
                              setDeliveryModalOrder(ord);
                              setDeliveryData({ phone: ord.phone, address: ord.address, extraPay: '', billImage: '' });
                            }} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md transition-all">
                              🚀 Báo Giao Hàng Cho Khách
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: KHO HÀNG SẴN ================= */}
        {tab === 'ready' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Kho Hàng Sẵn / Thanh Lý / Dư Order</h2>
                <p className="text-xs text-gray-500 mt-0.5">Danh sách hàng lẻ size, hàng tồn hoặc dư sẵn tại kho cho CTV đăng bài bán ngay.</p>
              </div>
              {user.role === 'admin' && (
                <button onClick={() => {
                  setEditingReadyItem(null);
                  setReadyForm({ name: '', specs: '', stock: '1', costPrice: '', sellPrice: '', images: ['', '', '', ''] });
                  setReadyItemModalOpen(true);
                }} className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold shadow-md transition-all">
                  + Thêm Món Hàng Sẵn
                </button>
              )}
            </div>

            {/* LƯỚI SẢN PHẨM HÀNG SẴN */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {readyItems.map(item => {
                const sellPrice = Number(item.sellPrice) || 0;
                const costPrice = Number(item.costPrice) || 0;

                return (
                  <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                    <div className="relative h-64 bg-gray-100">
                      {item.images && item.images[0] ? (
                        <img src={item.images[0]} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">Không có ảnh</div>
                      )}
                      <span className={`absolute top-3 left-3 px-3 py-1 rounded-xl text-xs font-bold ${item.stock > 0 ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                        {item.stock > 0 ? `Còn sẵn: ${item.stock}` : 'Hết hàng'}
                      </span>
                    </div>
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="font-bold text-gray-800 text-base">{item.name}</h3>
                        <p className="text-xs text-gray-600 mt-1">{item.specs}</p>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-sm font-bold text-orange-600">Giá bán: {sellPrice.toLocaleString()} ₫</span>
                          {user.role === 'admin' && <span className="text-xs text-gray-400 font-medium">Vốn: {costPrice.toLocaleString()} ₫</span>}
                        </div>
                      </div>

                      {/* HÀNH ĐỘNG */}
                      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                        <a href={item.images[0]} download target="_blank" rel="noreferrer" className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold text-center flex-1">
                          Tải ảnh
                        </a>
                        {user.role === 'admin' && (
                          <button onClick={() => {
                            setEditingReadyItem(item);
                            setReadyForm({
                              name: item.name,
                              specs: item.specs,
                              stock: String(item.stock),
                              costPrice: String(item.costPrice),
                              sellPrice: String(item.sellPrice),
                              images: item.images || ['', '', '', '']
                            });
                            setReadyItemModalOpen(true);
                          }} className="px-3 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-bold">
                            Sửa
                          </button>
                        )}
                        {item.stock > 0 && (
                          <button onClick={() => {
                            setReadyBuyModalItem(item);
                            setReadyBuyData({ customerName: '', phone: '', address: '', commission: '', payType: 'cod', depositAmount: '', billImage: '' });
                          }} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-md flex-1">
                            Chốt đơn
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= TAB 3: TRACKING & ĐỢT KHO ================= */}
        {tab === 'tracking' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
            <h2 className="text-lg font-bold text-gray-800">Quản Lý Vận Đơn Trung Quốc & Đợt Kho</h2>
            <p className="text-sm text-gray-500">Tại đây bạn có thể kiểm tra danh sách các mã vận đơn Trung Quốc đã về kho hoặc đang trên đường về.</p>
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 text-orange-800 text-sm">
              💡 Mẹo: Khi hàng về tới kho Việt Nam, hãy vào Tab 1 cập nhật trạng thái đơn hàng sang <strong className="font-bold">"Xuất kho"</strong> hoặc <strong className="font-bold">"Có sẵn"</strong> để tiến hành in tem A6 giao hàng!
            </div>
          </div>
        )}

        {/* ================= TAB 4: TẠO ĐƠN TRẢ HÀNG & A6 (ADMIN) ================= */}
        {tab === 'print' && user.role === 'admin' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <h2 className="text-base font-bold text-gray-800 mb-4">🖨️ Tạo Mã Vận Đơn & In Tem A6 (Chờ Gói Hàng)</h2>
              <p className="text-xs text-gray-500 mb-4">Chọn đơn hàng đã sẵn sàng giao, nhập MVĐ SPX (hoặc để hệ thống tự sinh ngẫu nhiên) để tạo tem A6 chuẩn quét vạch & QR 300 DPI.</p>
              
              <div className="space-y-3">
                {orders.filter(o => o.status === 'Xuất kho' || o.status === 'Có sẵn').map(ord => (
                  <div key={ord.id} className="border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 bg-gray-50">
                    <div>
                      <span className="font-bold text-orange-600 mr-2">#{ord.id}</span>
                      <span className="font-bold text-gray-800">{ord.customerName} — {ord.phone}</span>
                      <p className="text-xs text-gray-600 mt-1">{ord.address}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Sản phẩm: {ord.itemsText}</p>
                    </div>
                    <div className="flex items-center space-x-2 w-full md:w-auto">
                      <input id={`spx-input-${ord.id}`} defaultValue={ord.spxTracking || `SPXVN${Math.floor(100000000000 + Math.random() * 900000000000)}B`} placeholder="Nhập MVĐ SPX..." className="px-3 py-2 rounded-xl border border-gray-200 text-xs w-48" />
                      <button onClick={async () => {
                        const inputEl = document.getElementById(`spx-input-${ord.id}`) as HTMLInputElement;
                        const spxVal = inputEl.value.trim();
                        const updated = orders.map(x => x.id === ord.id ? {...x, spxTracking: spxVal, status: 'Đã trả hàng'} : x);
                        setOrders(updated);
                        await saveOrdersToFirebase(updated);
                        alert(`Đã lưu MVĐ ${spxVal} và chuyển đơn #${ord.id} sang danh sách hoàn thành!`);
                      }} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold whitespace-nowrap shadow-md">
                        Tạo & Lưu MVĐ A6
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* IN TEM A6 MẪU TRỰC QUAN */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <h2 className="text-base font-bold text-gray-800 mb-4">Xem Trước & In Tem A6 (Chuẩn 300 DPI)</h2>
              {orders.filter(o => o.spxTracking).slice(0, 1).map(ord => {
                const price = Number(ord.price) || 0;
                const deposit = Number(ord.deposit) || 0;
                const ship = Number(ord.shippingFee) || 0;
                const extra = ord.deliveryInfo ? Number(ord.deliveryInfo.extraPay) || 0 : 0;
                const cod = Math.max(0, price + ship - deposit - extra);

                return (
                  <div key={ord.id} className="flex flex-col items-center">
                    <div id="print-a6-template" className="w-[100mm] bg-white border-2 border-dashed border-gray-400 p-4 text-xs font-sans text-black relative shadow-lg">
                      <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-2">
                        <span className="font-extrabold text-lg">EXPRESS A6</span>
                        <span className="font-bold text-sm">Serenade Order</span>
                      </div>
                      
                      {/* BARCODE & QR */}
                      <div className="flex flex-col items-center my-2 border-b border-black pb-2">
                        <svg className="barcode-svg" data-value={ord.spxTracking}></svg>
                        <span className="text-[10px] font-bold mt-1">Mã vận đơn: {ord.spxTracking}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 border-b border-black pb-2 mb-2 text-[11px]">
                        <div>
                          <p className="font-bold">TỪ:</p>
                          <p>Trúc Quỳnh</p>
                          <p>307B Nguyễn Văn Luông, Q.6, TP.HCM</p>
                        </div>
                        <div>
                          <p className="font-bold">ĐẾN:</p>
                          <p className="font-bold">{ord.customerName} — {ord.phone}</p>
                          <p>{ord.address}</p>
                        </div>
                      </div>

                      <div className="border-b border-black pb-2 mb-2">
                        <p className="font-bold text-[11px]">NỘI DUNG HÀNG:</p>
                        <p className="text-[11px] whitespace-pre-line mt-0.5">{ord.itemsText}</p>
                      </div>

                      <div className="flex justify-between items-center pt-1">
                        <div>
                          <p className="font-bold text-sm">TIỀN THU HỘ (COD):</p>
                          <p className="text-lg font-extrabold">{cod.toLocaleString()} ₫</p>
                        </div>
                        <div className="qr-container" data-value={ord.spxTracking}></div>
                      </div>
                    </div>

                    <button onClick={() => window.print()} className="mt-4 px-6 py-3 bg-orange-500 text-white rounded-xl font-bold shadow-md text-sm">
                      🖨️ In Tem A6 Ngay
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= TAB 5: CTV & HOA HỒNG (ADMIN) ================= */}
        {tab === 'ctv' && user.role === 'admin' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <h2 className="text-base font-bold text-gray-800 mb-4">Thêm / Quản Lý Tài Khoản CTV</h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const name = (e.currentTarget.elements.namedItem('name') as HTMLInputElement).value.trim();
                const username = (e.currentTarget.elements.namedItem('username') as HTMLInputElement).value.trim();
                const pass = (e.currentTarget.elements.namedItem('pass') as HTMLInputElement).value.trim();
                
                const newCtv = { name, username, pass, bankInfo: '' };
                const updated = [...ctvs, newCtv];
                setCtvs(updated);
                await saveCtvsToFirebase(updated);
                e.currentTarget.reset();
                alert(`Tạo CTV ${name} thành công!`);
              }} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input name="name" required placeholder="Tên hiển thị CTV (VD: MOON)" className="px-3 py-2 rounded-xl border border-gray-200 text-sm" />
                <input name="username" required placeholder="Tên đăng nhập (VD: moon)" className="px-3 py-2 rounded-xl border border-gray-200 text-sm" />
                <input name="pass" required placeholder="Mật khẩu" className="px-3 py-2 rounded-xl border border-gray-200 text-sm" />
                <button type="submit" className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm shadow-md">
                  + Tạo Tài Khoản CTV
                </button>
              </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ctvs.map(c => {
                const ctvOrders = orders.filter(o => o.ctvName === c.name);
                const totalComm = ctvOrders.length * 5000; // Mặc định hoa hồng 5k/đơn hoặc tính theo yêu cầu

                return (
                  <div key={c.username} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-gray-800 text-base">{c.name} <span className="text-xs text-gray-400 font-normal">(@{c.username} / pass: {c.pass})</span></h3>
                      <p className="text-xs text-orange-600 font-semibold mt-1">Tổng đơn: {ctvOrders.length} đơn</p>
                      <p className="text-xs text-emerald-600 font-semibold mt-0.5">Hoa hồng chưa thanh toán: {totalComm.toLocaleString()} ₫</p>
                    </div>
                    <button onClick={async () => {
                      if (confirm(`Xóa CTV ${c.name}?`)) {
                        const updated = ctvs.filter(x => x.username !== c.username);
                        setCtvs(updated);
                        await saveCtvsToFirebase(updated);
                      }
                    }} className="text-red-500 hover:text-red-700 p-2">🗑️</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= TAB 6: BÁO CÁO & THUẾ (ADMIN) ================= */}
        {tab === 'tax' && user.role === 'admin' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
            <h2 className="text-lg font-bold text-gray-800">📊 Báo Cáo Doanh Thu & Tính Thuế (1.5%)</h2>
            
            <div className="flex items-center space-x-3 bg-orange-50 p-4 rounded-xl border border-orange-200">
              <input type="checkbox" checked={taxSkipPersonal} onChange={e => setTaxSkipPersonal(e.target.checked)} id="skip-personal" className="w-4 h-4 text-orange-500 rounded" />
              <label htmlFor="skip-personal" className="text-sm font-semibold text-orange-900 cursor-pointer">
                Tự động bỏ qua các đơn mua cá nhân / shop (Doanh thu = 0 ₫) để báo cáo thuế chính xác tuyệt đối.
              </label>
            </div>

            {(() => {
              const validOrders = orders.filter(o => !taxSkipPersonal || (o.ctvName !== 'Shop' && o.ctvName !== 'Cá nhân'));
              const totalRevenue = validOrders.reduce((acc, o) => acc + (Number(o.price) || 0), 0);
              const totalTax = totalRevenue * 0.015;

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200">
                    <p className="text-xs font-bold text-gray-500">TỔNG DOANH THU BÁN HÀNG</p>
                    <p className="text-2xl font-extrabold text-gray-900 mt-1">{totalRevenue.toLocaleString()} ₫</p>
                  </div>
                  <div className="bg-orange-50 p-5 rounded-2xl border border-orange-200">
                    <p className="text-xs font-bold text-orange-600">THUẾ KHOÁN PHẢI NỘP (1.5%)</p>
                    <p className="text-2xl font-extrabold text-orange-700 mt-1">{totalTax.toLocaleString()} ₫</p>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </main>

      {/* ================= MODAL BÁO GIAO HÀNG CHO CTV ================= */}
      {deliveryModalOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-lg text-gray-800">Báo Giao Hàng — #{deliveryModalOrder.id}</h3>
            
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">SỐ ĐIỆN THOẠI NHẬN HÀNG</label>
              <input value={deliveryData.phone} onChange={e => setDeliveryData({...deliveryData, phone: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">ĐỊA CHỈ NHẬN HÀNG</label>
              <textarea rows={2} value={deliveryData.address} onChange={e => setDeliveryData({...deliveryData, address: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"></textarea>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">KHÁCH TRẢ THÊM (VNĐ)</label>
              <div className="flex items-center space-x-2">
                <input type="number" value={deliveryData.extraPay} onChange={e => setDeliveryData({...deliveryData, extraPay: e.target.value})} placeholder="0" className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
                <button type="button" onClick={() => {
                  const p = Number(deliveryModalOrder.price) || 0;
                  const s = Number(deliveryModalOrder.shippingFee) || 0;
                  const d = Number(deliveryModalOrder.deposit) || 0;
                  const remain = Math.max(0, p + s - d);
                  setDeliveryData({...deliveryData, extraPay: String(remain)});
                }} className="px-3 py-2 bg-orange-100 text-orange-700 font-bold rounded-xl text-xs whitespace-nowrap">
                  Bank Đủ
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">UPLOAD BILL CHUYỂN KHOẢN THÊM</label>
              <input type="file" accept="image/*" onChange={async (e) => {
                if (e.target.files && e.target.files[0]) {
                  const url = await uploadToCloudinary(e.target.files[0]);
                  setDeliveryData({...deliveryData, billImage: url});
                  alert('Tải ảnh bill thành công!');
                }
              }} className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100" />
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-gray-100">
              <button onClick={() => setDeliveryModalOrder(null)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold">Hủy</button>
              <button onClick={async () => {
                const updated = orders.map(o => o.id === deliveryModalOrder.id ? {
                  ...o,
                  phone: deliveryData.phone,
                  address: deliveryData.address,
                  deliveryInfo: {
                    phone: deliveryData.phone,
                    address: deliveryData.address,
                    extraPay: deliveryData.extraPay,
                    billImage: deliveryData.billImage,
                    time: new Date().toLocaleString('vi-VN')
                  }
                } : o);
                setOrders(updated);
                await saveOrdersToFirebase(updated);
                setDeliveryModalOrder(null);
                alert('Báo giao hàng thành công!');
              }} className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-md">
                Xác Nhận Báo Giao
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL CHỐT ĐƠN HÀNG SẴN ================= */}
      {readyBuyModalItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-lg text-gray-800">Chốt Đơn Hàng Sẵn: {readyBuyModalItem.name}</h3>
            
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">TÊN KHÁCH HÀNG</label>
              <input value={readyBuyData.customerName} onChange={e => setReadyBuyData({...readyBuyData, customerName: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">SỐ ĐIỆN THOẠI</label>
              <input value={readyBuyData.phone} onChange={e => setReadyBuyData({...readyBuyData, phone: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">ĐỊA CHỈ</label>
              <textarea rows={2} value={readyBuyData.address} onChange={e => setReadyBuyData({...readyBuyData, address: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"></textarea>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">HOA HỒNG CTV TỰ NHẬP (VNĐ)</label>
              <input type="number" value={readyBuyData.commission} onChange={e => setReadyBuyData({...readyBuyData, commission: e.target.value})} placeholder="VD: 20000" className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
              <p className="text-xs text-orange-600 font-semibold mt-1">Giá khách mua = Giá bán ({Number(readyBuyModalItem.sellPrice).toLocaleString()} ₫) + Hoa hồng</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">HÌNH THỨC THANH TOÁN</label>
              <select value={readyBuyData.payType} onChange={e => setReadyBuyData({...readyBuyData, payType: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm">
                <option value="cod">Khách COD</option>
                <option value="deposit">Khách Cọc</option>
                <option value="bank_full">Bank Full</option>
              </select>
            </div>

            {readyBuyData.payType === 'deposit' && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">SỐ TIỀN CỌC (VNĐ)</label>
                <input type="number" value={readyBuyData.depositAmount} onChange={e => setReadyBuyData({...readyBuyData, depositAmount: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">UPLOAD BILL CHUYỂN KHOẢN (NẾU CÓ)</label>
              <input type="file" accept="image/*" onChange={async (e) => {
                if (e.target.files && e.target.files[0]) {
                  const url = await uploadToCloudinary(e.target.files[0]);
                  setReadyBuyData({...readyBuyData, billImage: url});
                  alert('Tải ảnh bill thành công!');
                }
              }} className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-orange-50 file:text-orange-700" />
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-gray-100">
              <button onClick={() => setReadyBuyModalItem(null)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold">Hủy</button>
              <button onClick={async () => {
                const sellP = Number(readyBuyModalItem.sellPrice) || 0;
                const comm = Number(readyBuyData.commission) || 0;
                const finalPrice = sellP + comm;
                const depositAmt = readyBuyData.payType === 'bank_full' ? finalPrice : (readyBuyData.payType === 'deposit' ? Number(readyBuyData.depositAmount) || 0 : 0);

                const newId = orders.length > 0 ? Math.max(...orders.map(o => o.id)) + 1 : 2601;
                const orderItem = {
                  id: newId,
                  ctvName: user.role === 'ctv' ? user.name : 'MOON',
                  customerName: readyBuyData.customerName,
                  phone: readyBuyData.phone,
                  address: readyBuyData.address,
                  itemsText: `${readyBuyModalItem.name} (${readyBuyModalItem.specs})`,
                  chinaLink: '',
                  cnTracking: 'Hàng sẵn tại kho',
                  spxTracking: '',
                  price: String(finalPrice),
                  deposit: String(depositAmt),
                  shippingFee: '16000',
                  note: `Hàng sẵn - Hoa hồng CTV: ${comm.toLocaleString()} ₫`,
                  status: 'Có sẵn',
                  createdAt: new Date().toLocaleDateString('vi-VN'),
                  costPrice: Number(readyBuyModalItem.costPrice) || 0,
                  deliveryInfo: null,
                  extraBill: readyBuyData.billImage
                };

                // Trừ tồn kho sẵn
                const updatedReady = readyItems.map(ri => ri.id === readyBuyModalItem.id ? {...ri, stock: Math.max(0, ri.stock - 1)} : ri);
                setReadyItems(updatedReady);
                await saveReadyToFirebase(updatedReady);

                const updatedOrders = [orderItem, ...orders];
                setOrders(updatedOrders);
                await saveOrdersToFirebase(updatedOrders);

                setReadyBuyModalItem(null);
                alert(`Chốt đơn hàng sẵn #${newId} thành công!`);
              }} className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-md">
                Xác Nhận Chốt Đơn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL THÊM/SỬA HÀNG SẴN ================= */}
      {readyItemModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg text-gray-800">{editingReadyItem ? 'Sửa Món Hàng Sẵn' : 'Thêm Món Hàng Sẵn Mới'}</h3>
            
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">TÊN SẢN PHẨM</label>
              <input value={readyForm.name} onChange={e => setReadyForm({...readyForm, name: e.target.value})} placeholder="VD: Váy tiểu thư ren trắng..." className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">MÔ TẢ / SIZE / MÀU / TÌNH TRẠNG</label>
              <input value={readyForm.specs} onChange={e => setReadyForm({...readyForm, specs: e.target.value})} placeholder="VD: Size S, mới 100%..." className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">SỐ LƯỢNG TỒN</label>
                <input type="number" value={readyForm.stock} onChange={e => setReadyForm({...readyForm, stock: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">GIÁ VỐN (VNĐ)</label>
                <input type="number" value={readyForm.costPrice} onChange={e => setReadyForm({...readyForm, costPrice: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">GIÁ BÁN (VNĐ)</label>
                <input type="number" value={readyForm.sellPrice} onChange={e => setReadyForm({...readyForm, sellPrice: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">ẢNH CHỤP THẬT (TẢI LÊN NÉT CĂNG)</label>
              <div className="grid grid-cols-2 gap-2">
                {readyForm.images.map((imgUrl, idx) => (
                  <div key={idx} className="flex flex-col space-y-1">
                    <input type="file" accept="image/*" onChange={async (e) => {
                      if (e.target.files && e.target.files[0]) {
                        const url = await uploadToCloudinary(e.target.files[0], true);
                        const newImgs = [...readyForm.images];
                        newImgs[idx] = url;
                        setReadyForm({...readyForm, images: newImgs});
                      }
                    }} className="text-xs text-gray-500 file:py-1 file:px-2 file:rounded-lg file:border-0 file:bg-gray-100 file:font-bold" />
                    {imgUrl && <img src={imgUrl} alt="preview" className="w-full h-20 object-cover rounded-lg border" />}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-gray-100">
              <button onClick={() => setReadyItemModalOpen(false)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold">Hủy</button>
              <button onClick={async () => {
                const newId = editingReadyItem ? editingReadyItem.id : (readyItems.length > 0 ? Math.max(...readyItems.map(r => r.id)) + 1 : 1);
                const itemObj = {
                  id: newId,
                  name: readyForm.name,
                  specs: readyForm.specs,
                  stock: Number(readyForm.stock) || 1,
                  costPrice: Number(readyForm.costPrice) || 0,
                  sellPrice: Number(readyForm.sellPrice) || 0,
                  images: readyForm.images.filter(Boolean)
                };

                let updated;
                if (editingReadyItem) {
                  updated = readyItems.map(r => r.id === editingReadyItem.id ? itemObj : r);
                } else {
                  updated = [itemObj, ...readyItems];
                }
                setReadyItems(updated);
                await saveReadyToFirebase(updated);
                setReadyItemModalOpen(false);
                alert('Lưu món hàng sẵn thành công!');
              }} className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-md">
                Lưu Sản Phẩm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
