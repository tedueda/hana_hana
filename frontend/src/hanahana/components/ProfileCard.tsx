import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { photoUrl } from "../api/profile";
import { labelsFor } from "../labels";
import { useI18n } from "../i18n";
import type { PublicProfile } from "../types";

export const Avatar: React.FC<{
  path: string | null | undefined;
  name: string | null;
  className?: string;
}> = ({ path, name, className = "w-full aspect-[4/5]" }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    photoUrl(path).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [path]);
  return (
    <div
      className={`${className} bg-gradient-to-br from-rose-100 to-orange-100 overflow-hidden flex items-center justify-center`}
    >
      {url ? (
        <img
          src={url}
          alt={name ?? ""}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <span className="text-3xl font-bold text-rose-400">
          {(name ?? "?").slice(0, 1)}
        </span>
      )}
    </div>
  );
};

interface Props {
  profile: PublicProfile;
  regionName?: string;
  reasons?: string[];
  footer?: React.ReactNode;
}

const ProfileCard: React.FC<Props> = ({
  profile,
  regionName,
  reasons,
  footer,
}) => {
  const { t, lang } = useI18n();
  const L = labelsFor(lang);
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <Link to={`/app/users/${profile.id}`}>
        <Avatar path={profile.primary_photo_path} name={profile.nickname} />
      </Link>
      <div className="p-3 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-gray-900 truncate">
            {profile.nickname ?? t("profile.unnamed")}
          </span>
          {profile.age != null && (
            <span className="text-gray-500 text-sm">{profile.age}</span>
          )}
          {profile.is_verified && (
            <BadgeCheck
              className="w-4 h-4 text-sky-500"
              aria-label={t("profile.verifiedBadge")}
            />
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          {profile.nationality && (
            <span>{L.nationality[profile.nationality]}</span>
          )}
          {regionName && (
            <>
              <MapPin className="w-3 h-3" />
              <span className="truncate">{regionName}</span>
            </>
          )}
        </div>
        {reasons && reasons.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {reasons.slice(0, 3).map((r) => (
              <Badge
                key={r}
                variant="secondary"
                className="text-[10px] font-normal"
              >
                {r}
              </Badge>
            ))}
          </div>
        )}
        {footer}
      </div>
    </div>
  );
};

export default ProfileCard;
