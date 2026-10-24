# HeroUI v3 Component Library Reference Guide
**Authoritative Reference for Kero Admin Dashboard**

HeroUI v3 is built on **Tailwind CSS v4** and **React Aria Components**. It uses compound component architectures, CSS-based animations, and semantic token variables.

---

## 1. Core Principles & Import Rules
- **Package:** `@heroui/react` & `@heroui/styles`
- **Tailwind Setup:** `@import "tailwindcss";` followed by `@import "@heroui/styles";` in `globals.css`.
- **No Provider Required:** Do **NOT** wrap the app in `<HeroUIProvider>`.
- **Compound Structure:** Use dot-notation subcomponents (e.g., `<Card><Card.Header>...</Card.Header></Card>`).
- **Events:** Use `onPress` instead of `onClick` for buttons and interactive items.

---

## 2. Complete Component Catalogue & Compound Anatomy

### Layout & Containers
| Component | Import Pattern | Compound Anatomy / Example |
| :--- | :--- | :--- |
| **Card** | `import { Card } from "@heroui/react"` | `<Card><Card.Header><Card.Title>Title</Card.Title><Card.Description>Desc</Card.Description></Card.Header><Card.Content>Body</Card.Content><Card.Footer>Actions</Card.Footer></Card>` |
| **Surface** | `import { Surface } from "@heroui/react"` | High-elevation container with automatic border and backdrop styling. |
| **Toolbar** | `import { Toolbar } from "@heroui/react"` | `<Toolbar><Toolbar.Group>...</Toolbar.Group></Toolbar>` |
| **Separator** | `import { Separator } from "@heroui/react"` | `<Separator orientation="horizontal" />` |
| **ScrollShadow** | `import { ScrollShadow } from "@heroui/react"` | Smooth shadow fading for scrollable table or list containers. |

### Buttons & Interactive Controls
| Component | Import Pattern | Compound Anatomy / Example |
| :--- | :--- | :--- |
| **Button** | `import { Button } from "@heroui/react"` | `<Button variant="primary" onPress={handler}>Label</Button>` |
| **ButtonGroup** | `import { ButtonGroup } from "@heroui/react"` | `<ButtonGroup><Button>One</Button><Button>Two</Button></ButtonGroup>` |
| **CloseButton** | `import { CloseButton } from "@heroui/react"` | Accessible modal/alert close trigger. |
| **ToggleButton** | `import { ToggleButton } from "@heroui/react"` | `<ToggleButton isSelected={val} onChange={setVal}>Pin</ToggleButton>` |
| **ToggleButtonGroup** | `import { ToggleButtonGroup } from "@heroui/react"` | Multi-select or segmented toggle controls. |

### Navigation & Overlays
| Component | Import Pattern | Compound Anatomy / Example |
| :--- | :--- | :--- |
| **Breadcrumbs** | `import { Breadcrumbs } from "@heroui/react"` | `<Breadcrumbs><Breadcrumbs.Item href="/trips">Trips</Breadcrumbs.Item><Breadcrumbs.Item>Detail</Breadcrumbs.Item></Breadcrumbs>` |
| **Link** | `import { Link } from "@heroui/react"` | Accessible styled routing link. |
| **Dropdown** | `import { Dropdown } from "@heroui/react"` | `<Dropdown><Dropdown.Trigger><Button>Actions</Button></Dropdown.Trigger><Dropdown.Menu><Dropdown.Item key="edit">Edit</Dropdown.Item></Dropdown.Menu></Dropdown>` |
| **Popover** | `import { Popover } from "@heroui/react"` | `<Popover><Popover.Trigger>...</Popover.Trigger><Popover.Content>...</Popover.Content></Popover>` |
| **Tooltip** | `import { Tooltip } from "@heroui/react"` | `<Tooltip content="Driver rating out of 5.0"><Badge>4.9</Badge></Tooltip>` |
| **Drawer** | `import { Drawer } from "@heroui/react"` | Side sheet for mobile navigation and detail slide-overs. |
| **Modal** | `import { Modal } from "@heroui/react"` | `<Modal isOpen={isOpen} onOpenChange={setOpen}><Modal.Content><Modal.Header>Title</Modal.Header><Modal.Body>Content</Modal.Body><Modal.Footer><Button>Close</Button></Modal.Footer></Modal.Content></Modal>` |
| **AlertDialog** | `import { AlertDialog } from "@heroui/react"` | For high-risk destructive actions (e.g. "Suspend Driver", "Force Cancel Trip"). |

### Form Inputs & Fields
| Component | Import Pattern | Compound Anatomy / Example |
| :--- | :--- | :--- |
| **Form** | `import { Form } from "@heroui/react"` | Native HTML form wrapper with React Aria validation. |
| **Input / TextField**| `import { TextField, Input, Label, FieldError } from "@heroui/react"` | `<TextField><Label>Work Email</Label><Input /><FieldError /></TextField>` |
| **InputGroup** | `import { InputGroup } from "@heroui/react"` | Input with prefix/suffix currency symbols (e.g. `₦` or `%`). |
| **InputOTP** | `import { InputOTP } from "@heroui/react"` | Segmented 4 or 6-digit pin verification code inputs. |
| **TextArea** | `import { TextArea } from "@heroui/react"` | Multi-line text field for review rejection reasons or notes. |
| **NumberField** | `import { NumberField } from "@heroui/react"` | Stepper inputs for surge multipliers, wait-time fees, and fare rules. |
| **SearchField** | `import { SearchField } from "@heroui/react"` | Search input with clear button and keyboard shortcuts. |
| **Checkbox / CheckboxGroup** | `import { Checkbox, CheckboxGroup } from "@heroui/react"` | For bulk selection in tables and role permission matrix toggling. |
| **RadioGroup** | `import { RadioGroup, Radio } from "@heroui/react"` | Mutually exclusive choices (e.g. vehicle type, payment mode). |
| **Switch** | `import { Switch } from "@heroui/react"` | High-visibility toggle for active status, dark mode, surge zones. |
| **Select / ComboBox** | `import { Select, ComboBox } from "@heroui/react"` | Filterable dropdown selection for vehicle types, states, and roles. |
| **Autocomplete** | `import { Autocomplete } from "@heroui/react"` | Asynchronous query suggestions for drivers, riders, and trip locations. |

### Date, Time & Calendars
| Component | Import Pattern | Compound Anatomy / Example |
| :--- | :--- | :--- |
| **Calendar** | `import { Calendar } from "@heroui/react"` | Full monthly calendar grid. |
| **RangeCalendar**| `import { RangeCalendar } from "@heroui/react"` | Date range picker for audit logs and revenue reports. |
| **DatePicker** | `import { DatePicker } from "@heroui/react"` | Single date picker popover. |
| **DateRangePicker** | `import { DateRangePicker } from "@heroui/react"` | Date range popover with quick presets (Today, Last 7d, This Month). |
| **DateField / TimeField** | `import { DateField, TimeField } from "@heroui/react"` | Masked text inputs for date and time formatting. |

### Data Display, Tables & Feedback
| Component | Import Pattern | Compound Anatomy / Example |
| :--- | :--- | :--- |
| **Table** | `import { Table } from "@heroui/react"` | `<Table aria-label="Drivers"><Table.Header><Table.Column>Driver</Table.Column><Table.Column>Status</Table.Column></Table.Header><Table.Body><Table.Row><Table.Cell>Musa</Table.Cell><Table.Cell>Active</Table.Cell></Table.Row></Table.Body></Table>` |
| **Pagination** | `import { Pagination } from "@heroui/react"` | `<Pagination total={10} page={page} onChange={setPage} />` |
| **Badge** | `import { Badge } from "@heroui/react"` | Notification counter badges on icons or avatars. |
| **Chip / TagGroup**| `import { Chip, TagGroup } from "@heroui/react"` | Status indicators (`Active`, `Suspended`, `Pending KYC`). |
| **Avatar / AvatarGroup** | `import { Avatar, AvatarGroup } from "@heroui/react"` | User photos with fallback initials and presence status indicators. |
| **Accordion / Disclosure** | `import { Accordion, Disclosure } from "@heroui/react"` | Collapsible sections for role permission groupings and FAQs. |
| **Tabs** | `import { Tabs } from "@heroui/react"` | `<Tabs><Tabs.List><Tabs.Tab id="kyc">KYC</Tabs.Tab></Tabs.List><Tabs.Panel id="kyc">...</Tabs.Panel></Tabs>` |
| **Alert** | `import { Alert } from "@heroui/react"` | In-page feedback callouts (`info`, `success`, `warning`, `danger`). |
| **ProgressBar / ProgressCircle** | `import { ProgressBar, ProgressCircle } from "@heroui/react"` | Loading indicators and driver verification completion percentages. |
| **Spinner** | `import { Spinner } from "@heroui/react"` | Minimal spinning loader for async buttons and data queries. |
| **Skeleton** | `import { Skeleton } from "@heroui/react"` | Ghost placeholder cards and table rows while loading. |
| **Toast** | `import { toast } from "sonner"` (or HeroUI Toast) | Floating notifications for user feedback and socket triggers. |
| **Kbd** | `import { Kbd } from "@heroui/react"` | Keyboard shortcut badges (e.g. `<Kbd>⌘F</Kbd>`). |
| **Meter** | `import { Meter } from "@heroui/react"` | Capacity indicators (e.g. fleet availability % or disk usage). |

---

## 3. Semantic Token Integration with Kero Theme
HeroUI v3 variants adapt to Kero's color variables:
- `primary`: `--primary` (`#44423c` in Light / `#b6b4b1` in Dark)
- `secondary`: `--secondary` (`#bb9348` Kero Gold)
- `danger`: `--danger` (`#ff0000` / `#ff5454`)
- `success`: `--success` (`#34c759`)
- `surface`: `--surface` (`#ffffff` in Light / `#1b1a18` in Dark)
