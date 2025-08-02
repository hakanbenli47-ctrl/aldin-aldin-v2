import Image from 'next/image';
import { useRouter } from 'next/router';
import React from 'react';

type Ilan = {
  id: number;
  title: string;
  desc?: string;
  price: string;
  kategori_id?: number;
  resim_url?: string[] | string | null;
  created_at?: string;
  doped?: boolean;
  doped_expiration?: string;
};

type ProductCardProps = {
  product: Ilan;
  favoriler: number[];
  toggleFavori: (id: number) => void;
  sepetteVarMi: (id: number) => any;
  sepeteEkle: (urun: Ilan) => Promise<void>;
  findKategoriAd: (id?: number) => string;
  getRemainingTime: (date?: string) => string;
  from?: string; // EKLEDİK!
};

function isYeni(created_at?: string) {
  if (!created_at) return false;
  const ilanTarihi = new Date(created_at).getTime();
  const simdi = Date.now();
  return simdi - ilanTarihi < 86400000;
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  favoriler,
  toggleFavori,
  sepetteVarMi,
  sepeteEkle,
  findKategoriAd,
  getRemainingTime,
  from = "index"
}) => {
  const router = useRouter();
  const sepette = sepetteVarMi(product.id);

  return (
    <div
      onClick={() => router.push(`/urun/${product.id}?from=${from}`)}
      style={{
        background: product.doped ? '#fef08a' : '#fff',
        borderRadius: 16,
        padding: 15,
        boxShadow: product.doped ? '0 3px 14px #eab30818' : '0 3px 13px #16a34a0f',
        transition: 'transform 0.2s',
        cursor: 'pointer',
        position: 'relative'
      }}
    >
      {isYeni(product.created_at) && !product.doped && (
        <span
          style={{
            position: 'absolute',
            top: 13,
            left: 13,
            background: '#16a34a',
            color: '#fff',
            fontWeight: 800,
            fontSize: 13,
            borderRadius: 8,
            padding: '4px 13px',
            boxShadow: '0 2px 8px #16a34a15',
            zIndex: 1
          }}
        >
          Yeni
        </span>
      )}

      <span
        onClick={e => {
          e.stopPropagation();
          toggleFavori(product.id);
        }}
        title={favoriler.includes(product.id) ? 'Favorilerden çıkar' : 'Favorilere ekle'}
        style={{
          position: 'absolute',
          top: 12,
          right: 14,
          fontSize: 23,
          color: favoriler.includes(product.id) ? '#fb8500' : '#bbb',
          cursor: 'pointer',
          userSelect: 'none',
          zIndex: 2,
          transition: 'color 0.22s'
        }}
      >
        {favoriler.includes(product.id) ? '❤️' : '🤍'}
      </span>

      <img
        src={
          Array.isArray(product.resim_url)
            ? product.resim_url[0] || '/placeholder.jpg'
            : product.resim_url || '/placeholder.jpg'
        }
        alt={product.title}
        style={{
          width: '100%',
          height: 160,
          objectFit: 'cover',
          borderRadius: 10,
          marginBottom: 12,
          background: product.doped ? '#fef08a' : '#f0fdf4'
        }}
      />

      <h3
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: product.doped ? '#78350f' : '#1e293b',
          marginBottom: 6
        }}
      >
        {product.title}
      </h3>

      <div
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: product.doped ? '#b45309' : '#16a34a',
          marginBottom: 4
        }}
      >
        {product.price} ₺
      </div>

      {product.doped && (
        <div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>
          {getRemainingTime(product.doped_expiration)}
        </div>
      )}

      <span
        style={{
          fontSize: 14,
          color: product.doped ? '#a16207' : '#64748b'
        }}
      >
        {findKategoriAd(product.kategori_id)}
      </span>

      {!sepette ? (
        <button
          style={{
            marginTop: 12,
            background: product.doped
              ? 'linear-gradient(90deg, #b45309 0%, #78350f 80%)'
              : 'linear-gradient(90deg, #1bbd8a 0%, #16a34a 80%)',
            color: '#fff',
            padding: '9px 0',
            borderRadius: 10,
            border: 'none',
            fontWeight: 700,
            fontSize: 15,
            cursor: 'pointer',
            width: '100%',
            boxShadow: '0 2px 8px #fb850022',
            letterSpacing: 0.5,
            transition: 'background 0.18s'
          }}
          onClick={e => {
            e.stopPropagation();
            sepeteEkle(product);
          }}
        >
          🛒 Sepete Ekle
        </button>
      ) : (
        <button
          style={{
            marginTop: 12,
            background: 'linear-gradient(90deg, #fb8500 0%, #ffbc38 80%)',
            color: '#fff',
            padding: '9px 0',
            borderRadius: 10,
            border: 'none',
            fontWeight: 700,
            fontSize: 15,
            cursor: 'pointer',
            width: '100%',
            boxShadow: '0 2px 8px #fb850022',
            letterSpacing: 0.5
          }}
          onClick={e => {
            e.stopPropagation();
            window.location.href = '/sepet2';
          }}
        >
          Sepete Git
        </button>
      )}
    </div>
  );
};

export default ProductCard;
