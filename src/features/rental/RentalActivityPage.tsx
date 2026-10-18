import { useApp } from "../../app/provider";
import { visibleRooms, buildingOf } from "../../domain/selectors";
import { PageTitle, Status, Empty } from "../../components/ui";
import { dateText } from "../../lib/format";
export default function RentalActivityPage({
  appointments = false,
}: {
  appointments?: boolean;
}) {
  const { data, user, execute } = useApp();
  if (!user) return null;
  const rooms = visibleRooms(data, user),
    isTenant = user.role === "tenant";
  const requests = data.requests.filter((r) =>
    isTenant ? r.tenantId === user.id : rooms.some((x) => x.id === r.roomId),
  );
  const visits = data.appointments.filter((a) =>
    isTenant
      ? a.tenantId === user.id
      : rooms.some((r) =>
          data.listings.some((l) => l.id === a.listingId && l.roomId === r.id),
        ),
  );
  return (
    <>
      <PageTitle
        title={appointments ? "Lịch xem phòng" : "Yêu cầu thuê phòng"}
        description={
          appointments
            ? "Một cuộc hẹn rõ ràng để bắt đầu lựa chọn nơi ở."
            : "Theo dõi phản hồi và xác nhận việc thuê với hai bên."
        }
      />
      <section className="panel table-panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Phòng / tòa nhà</th>
                <th>Người tìm thuê</th>
                <th>{appointments ? "Thời gian xem" : "Dự kiến vào ở"}</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {appointments
                ? visits.map((a) => {
                    const l = data.listings.find((l) => l.id === a.listingId)!,
                      r = data.rooms.find((r) => r.id === l.roomId)!,
                      u = data.users.find((u) => u.id === a.tenantId)!;
                    return (
                      <tr key={a.id}>
                        <td>
                          <strong>{r.name}</strong>
                          <small>{buildingOf(data, r).name}</small>
                          {a.note && <small>{a.note}</small>}
                        </td>
                        <td>
                          {u.name}
                          <small>{u.phone || u.email}</small>
                        </td>
                        <td>{new Date(a.date).toLocaleString("vi-VN")}</td>
                        <td>
                          <Status value={a.status} />
                        </td>
                        <td>
                          <div className="row-actions">
                            {!isTenant && a.status === "pending" && (
                              <button
                                className="btn primary small"
                                onClick={() =>
                                  execute(
                                    {
                                      type: "appointment.respond",
                                      payload: {
                                        id: a.id,
                                        status: "confirmed",
                                      },
                                    },
                                    "Đã xác nhận lịch xem.",
                                  )
                                }
                              >
                                Xác nhận lịch
                              </button>
                            )}
                            {!isTenant && a.status === "confirmed" && (
                              <button
                                className="btn secondary small"
                                onClick={() =>
                                  execute(
                                    {
                                      type: "appointment.respond",
                                      payload: {
                                        id: a.id,
                                        status: "completed",
                                      },
                                    },
                                    "Đã ghi nhận xem phòng.",
                                  )
                                }
                              >
                                Đã đến xem
                              </button>
                            )}
                            {["pending", "confirmed"].includes(a.status) && (
                              <button
                                className="btn text small danger"
                                onClick={() =>
                                  execute(
                                    {
                                      type: "appointment.respond",
                                      payload: {
                                        id: a.id,
                                        status: "cancelled",
                                      },
                                    },
                                    "Đã hủy lịch.",
                                  )
                                }
                              >
                                Hủy lịch
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                : requests.map((req) => {
                    const r = data.rooms.find((r) => r.id === req.roomId)!,
                      u = data.users.find((u) => u.id === req.tenantId)!;
                    return (
                      <tr key={req.id}>
                        <td>
                          <strong>{r.name}</strong>
                          <small>{buildingOf(data, r).name}</small>
                          {req.note && <small>{req.note}</small>}
                        </td>
                        <td>
                          {u.name}
                          <small>
                            {req.people} người · {u.phone || u.email}
                          </small>
                        </td>
                        <td>{dateText(req.date)}</td>
                        <td>
                          <Status value={req.status} />
                        </td>
                        <td>
                          <div className="row-actions">
                            {!isTenant && req.status === "pending" && (
                              <>
                                <button
                                  className="btn primary small"
                                  onClick={() =>
                                    execute(
                                      {
                                        type: "request.respond",
                                        payload: { id: req.id, accept: true },
                                      },
                                      "Đã chấp thuận. Người thuê cần xác nhận để hoàn tất.",
                                    )
                                  }
                                >
                                  Chấp thuận
                                </button>
                                <button
                                  className="btn text danger small"
                                  onClick={() =>
                                    execute(
                                      {
                                        type: "request.respond",
                                        payload: { id: req.id, accept: false },
                                      },
                                      "Đã từ chối yêu cầu.",
                                    )
                                  }
                                >
                                  Từ chối
                                </button>
                              </>
                            )}
                            {isTenant && req.status === "accepted" && (
                              <button
                                className="btn primary small"
                                onClick={() => {
                                  if (
                                    confirm(
                                      "Xác nhận đã thống nhất giá, thời gian và điều kiện thuê với chủ trọ? Hệ thống sẽ kích hoạt hồ sơ thuê.",
                                    )
                                  )
                                    execute(
                                      {
                                        type: "request.confirm",
                                        payload: { id: req.id },
                                      },
                                      "Đã xác nhận thuê. Xem thông tin tại Phòng của tôi.",
                                    );
                                }}
                              >
                                Xác nhận thuê
                              </button>
                            )}
                            {isTenant &&
                              ["pending", "accepted"].includes(req.status) && (
                                <button
                                  className="btn text danger small"
                                  onClick={() =>
                                    execute(
                                      {
                                        type: "request.cancel",
                                        payload: { id: req.id },
                                      },
                                      "Đã hủy yêu cầu.",
                                    )
                                  }
                                >
                                  Hủy
                                </button>
                              )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
        {!(appointments ? visits.length : requests.length) && (
          <Empty
            title={
              appointments ? "Chưa có lịch xem phòng" : "Chưa có yêu cầu thuê"
            }
            description="Các yêu cầu từ trang chi tiết phòng sẽ xuất hiện tại đây."
            action={
              isTenant ? (
                <a className="btn primary" href="#/">
                  Tìm phòng phù hợp
                </a>
              ) : undefined
            }
          />
        )}
      </section>
    </>
  );
}
