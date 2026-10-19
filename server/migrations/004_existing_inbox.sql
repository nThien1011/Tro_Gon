INSERT INTO notifications (id,userId,type,title,body,href,createdAt)
SELECT UUID(),u.id,'inbox.existing','Có tin đăng đang chờ duyệt',l.title,'/app/moderation',DATE_FORMAT(UTC_TIMESTAMP(),'%Y-%m-%dT%H:%i:%s.000Z')
FROM listings l JOIN users u ON u.role='admin' AND u.active=TRUE
WHERE l.status='pending';

INSERT INTO notifications (id,userId,type,title,body,href,createdAt)
SELECT UUID(),i.tenantId,'inbox.existing','Bạn có hóa đơn chưa hoàn tất',CONCAT('Hóa đơn kỳ ',i.period,' đang chờ thanh toán hoặc xác nhận.'),CONCAT('/app/billing?invoice=',i.id),DATE_FORMAT(UTC_TIMESTAMP(),'%Y-%m-%dT%H:%i:%s.000Z')
FROM invoices i JOIN users u ON u.id=i.tenantId AND u.active=TRUE
WHERE i.status='issued' AND i.paymentStatus<>'paid';

INSERT INTO notifications (id,userId,type,title,body,href,createdAt)
SELECT UUID(),b.ownerId,'inbox.existing','Có thanh toán cần đối chiếu',CONCAT('Hóa đơn kỳ ',i.period,' của phòng ',r.name,' đang chờ xác nhận.'),CONCAT('/app/billing?invoice=',i.id),DATE_FORMAT(UTC_TIMESTAMP(),'%Y-%m-%dT%H:%i:%s.000Z')
FROM invoices i JOIN rooms r ON r.id=i.roomId JOIN buildings b ON b.id=r.buildingId JOIN users u ON u.id=b.ownerId AND u.active=TRUE
WHERE i.status='issued' AND i.paymentStatus='pending';

INSERT INTO notifications (id,userId,type,title,body,href,createdAt)
SELECT UUID(),b.ownerId,'inbox.existing','Có yêu cầu sửa chữa đang mở',t.title,'/app/support',DATE_FORMAT(UTC_TIMESTAMP(),'%Y-%m-%dT%H:%i:%s.000Z')
FROM support_tickets t JOIN rooms r ON r.id=t.roomId JOIN buildings b ON b.id=r.buildingId JOIN users u ON u.id=b.ownerId AND u.active=TRUE
WHERE t.category='repair' AND t.status<>'resolved';

INSERT INTO notifications (id,userId,type,title,body,href,createdAt)
SELECT UUID(),u.id,'inbox.existing','Có báo cáo đang chờ xử lý',t.title,'/app/reports',DATE_FORMAT(UTC_TIMESTAMP(),'%Y-%m-%dT%H:%i:%s.000Z')
FROM support_tickets t JOIN users u ON u.role='admin' AND u.active=TRUE
WHERE t.category='report' AND t.status<>'resolved';

INSERT INTO notifications (id,userId,type,title,body,href,createdAt)
SELECT UUID(),b.ownerId,'inbox.existing','Có yêu cầu thuê đang chờ',CONCAT('Phòng ',r.name,' có yêu cầu thuê chưa xử lý.'),'/app/requests',DATE_FORMAT(UTC_TIMESTAMP(),'%Y-%m-%dT%H:%i:%s.000Z')
FROM rental_requests q JOIN rooms r ON r.id=q.roomId JOIN buildings b ON b.id=r.buildingId JOIN users u ON u.id=b.ownerId AND u.active=TRUE
WHERE q.status='pending';

INSERT INTO notifications (id,userId,type,title,body,href,createdAt)
SELECT UUID(),q.tenantId,'inbox.existing','Yêu cầu thuê đã được chấp thuận','Mở yêu cầu để kiểm tra và xác nhận nhận phòng.','/app/requests',DATE_FORMAT(UTC_TIMESTAMP(),'%Y-%m-%dT%H:%i:%s.000Z')
FROM rental_requests q JOIN users u ON u.id=q.tenantId AND u.active=TRUE
WHERE q.status='accepted';

INSERT INTO notifications (id,userId,type,title,body,href,createdAt)
SELECT UUID(),b.ownerId,'inbox.existing','Có lịch xem phòng đang chờ',CONCAT('Phòng ',r.name,' có lịch hẹn chưa xác nhận.'),'/app/appointments',DATE_FORMAT(UTC_TIMESTAMP(),'%Y-%m-%dT%H:%i:%s.000Z')
FROM appointments a JOIN listings l ON l.id=a.listingId JOIN rooms r ON r.id=l.roomId JOIN buildings b ON b.id=r.buildingId JOIN users u ON u.id=b.ownerId AND u.active=TRUE
WHERE a.status='pending';

UPDATE app_state SET version=version+1 WHERE id=1;
