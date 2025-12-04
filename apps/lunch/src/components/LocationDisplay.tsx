import { useState } from "react";
import { MapPin, Edit2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface LocationDisplayProps {
  address: string;
  onAddressChange: (address: string) => void;
}

export function LocationDisplay({ address, onAddressChange }: LocationDisplayProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(address);

  const handleSave = () => {
    if (editValue.trim()) {
      onAddressChange(editValue.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(address);
    setIsEditing(false);
  };

  return (
    <div className="bg-secondary/50 rounded-xl p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <MapPin className="h-4 w-4 text-primary" />
        <span className="font-medium">사무실 위치</span>
      </div>
      {isEditing ? (
        <div className="flex items-center gap-2">
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="flex-1"
            placeholder="주소를 입력하세요"
          />
          <Button size="icon" variant="ghost" onClick={handleSave}>
            <Check className="h-4 w-4 text-green-600" />
          </Button>
          <Button size="icon" variant="ghost" onClick={handleCancel}>
            <X className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <p className="font-medium text-foreground">{address}</p>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setIsEditing(true)}
            className="h-8 w-8"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
