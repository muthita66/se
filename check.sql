SELECT COUNT(*) FROM teachers;
SELECT COUNT(*) FROM teaching_assignments;
SELECT COUNT(*) FROM class_schedules;
SELECT * FROM teachers WHERE first_name LIKE '%สมชาย%';
SELECT ta.* FROM teaching_assignments ta JOIN teachers t ON ta.teacher_id = t.id WHERE t.first_name LIKE '%สมชาย%';
