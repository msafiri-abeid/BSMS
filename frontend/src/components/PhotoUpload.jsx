import { Button, Upload } from 'antd';
import { Camera, Image, X } from 'lucide-react';

const PhotoUpload = ({ file, onChange, hint = 'Take a photo or choose from gallery' }) => {
  const handleSelect = (f) => { onChange(f); return false; };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Upload
          accept="image/*"
          capture="environment"
          maxCount={1}
          showUploadList={false}
          beforeUpload={handleSelect}
          className="flex-1"
        >
          <Button className="!h-9 w-full flex items-center justify-center gap-1.5 !bg-brand-dark !text-white hover:!bg-brand-light border-none">
            <Camera className="w-4 h-4" />
            Take Photo
          </Button>
        </Upload>
        <Upload
          accept="image/*"
          maxCount={1}
          showUploadList={false}
          beforeUpload={handleSelect}
          className="flex-1"
        >
          <Button className="!h-9 w-full flex items-center justify-center gap-1.5">
            <Image className="w-4 h-4" />
            Gallery
          </Button>
        </Upload>
      </div>

      {file && (
        <div className="relative rounded-lg overflow-hidden border border-slate-200">
          <img
            src={URL.createObjectURL(file)}
            alt="Preview"
            className="w-full max-h-48 object-contain bg-slate-50"
          />
          <Button
            size="small"
            icon={<X className="w-3 h-3" />}
            onClick={() => onChange(null)}
            className="absolute top-1.5 right-1.5 !bg-white/90 !text-red-500"
          />
        </div>
      )}

      {!file && <div className="text-xs text-slate-400 text-center">{hint}</div>}
    </div>
  );
};

export default PhotoUpload;
