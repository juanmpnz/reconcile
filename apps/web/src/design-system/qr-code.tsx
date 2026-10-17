import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
/** Local generation only. No seed or image is transmitted to an external service. */
export function QrCode({ value, label }: { value: string; label: string }) {
  const [image, setImage] = useState('');
  useEffect(() => {
    let active = true;
    setImage('');
    void QRCode.toDataURL(value, {
      width: 220,
      margin: 2,
      errorCorrectionLevel: 'M',
    })
      .then((data) => {
        if (active) setImage(data);
      })
      .catch(() => {
        if (active) setImage('');
      });
    return () => {
      active = false;
    };
  }, [value]);
  return image ? (
    <img src={image} alt={label} width={220} height={220} />
  ) : (
    <p>Usá la clave manual para configurar tu aplicación autenticadora.</p>
  );
}
