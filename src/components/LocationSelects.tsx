import {
  provinces,
  districtsOf,
  wardsOf,
  changeLocation,
  type LocationSelection,
} from "../config/locations";

export default function LocationSelects({
  value,
  onChange,
  required = false,
  search = false,
}: {
  value: LocationSelection;
  onChange: (value: LocationSelection) => void;
  required?: boolean;
  search?: boolean;
}) {
  const options = [
    {
      field: "cityCode" as const,
      label: "Tỉnh / Thành phố",
      disabled: false,
      items: provinces,
      placeholder: search ? "Tất cả tỉnh / thành phố" : "Chọn tỉnh / thành phố",
    },
    {
      field: "districtCode" as const,
      label: "Quận / Huyện",
      disabled: !value.cityCode,
      items: districtsOf(value.cityCode),
      placeholder: search ? "Tất cả quận / huyện" : "Chọn quận / huyện",
    },
    {
      field: "wardCode" as const,
      label: "Phường / Xã",
      disabled:
        !value.districtCode ||
        wardsOf(value.cityCode, value.districtCode).length === 0,
      items: wardsOf(value.cityCode, value.districtCode),
      placeholder: search ? "Tất cả phường / xã" : "Chọn phường / xã",
    },
  ];
  return (
    <div
      className={
        search ? "location-selects search-location-selects" : "location-selects"
      }
    >
      {options.map(({ field, label, disabled, items, placeholder }) => (
        <label className={search ? "search-select" : "field"} key={field}>
          <span>
            {label}
            {required && !disabled && <b> *</b>}
          </span>
          <select
            name={field}
            aria-label={label}
            value={value[field]}
            required={required && !disabled}
            disabled={disabled}
            onChange={(e) =>
              onChange(changeLocation(value, field, e.target.value))
            }
          >
            <option value="">
              {disabled
                ? field === "districtCode"
                  ? "Chọn tỉnh / thành phố trước"
                  : value.districtCode
                    ? "Không có phường / xã trong danh mục"
                    : "Chọn quận / huyện trước"
                : placeholder}
            </option>
            {items.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}
