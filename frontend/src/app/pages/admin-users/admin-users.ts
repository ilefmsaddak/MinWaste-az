import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminUserService, User } from '../../services/admin-user.service';
import { LoggerService } from '../../services/logger.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-users.html',
  styleUrl: './admin-users.scss'
})
export class AdminUsers implements OnInit {
  users = signal<User[]>([]);
  isLoading = signal(true);
  searchQuery = signal('');
  filterStatus = signal<'all' | 'active' | 'suspended'>('all');
  selectedUser = signal<User | null>(null);
  showConfirmDialog = signal(false);
  confirmAction = signal<'suspend' | 'delete' | null>(null);

  constructor(
    private adminUserService: AdminUserService,
    private logger: LoggerService
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.isLoading.set(true);
    this.adminUserService.getAllUsers().subscribe({
      next: (data: any) => {
        // Handle different response formats
        let users: User[] = [];
        if (Array.isArray(data)) {
          users = data;
        } else if (data && typeof data === 'object') {
          // If data is wrapped in an object, try common property names
          users = data.users || data.data || data.result || [];
        }
        this.users.set(users);
        this.isLoading.set(false);
      },
      error: (err: any) => {
        this.logger.logApiError('Error loading users', err);
        this.isLoading.set(false);
      }
    });
  }

  get filteredUsers(): User[] {
    let filtered = this.users();

    if (this.filterStatus() !== 'all') {
      filtered = filtered.filter(u => u.status === this.filterStatus());
    }

    if (this.searchQuery()) {
      const query = this.searchQuery().toLowerCase();
      filtered = filtered.filter(u =>
        u.name.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query)
      );
    }

    return filtered;
  }

  openActionDialog(user: User, action: 'suspend' | 'delete'): void {
    this.selectedUser.set(user);
    this.confirmAction.set(action);
    this.showConfirmDialog.set(true);
  }

  confirmActionDialog(): void {
    const user = this.selectedUser();
    const action = this.confirmAction();

    if (!user || !action) return;

    if (action === 'suspend') {
      this.adminUserService.suspendUser(user.id).subscribe({
        next: () => {
          this.loadUsers();
          this.closeDialog();
        },
        error: (err: any) => {
          this.logger.error('Error suspending user', err);
          alert('Error suspending user');
        }
      });
    } else if (action === 'delete') {
      this.adminUserService.deleteUser(user.id).subscribe({
        next: () => {
          this.loadUsers();
          this.closeDialog();
        },
        error: (err: any) => {
          this.logger.error('Error deleting user', err);
          alert('Error deleting user');
        }
      });
    }
  }

  unsuspendUser(user: User): void {
    this.adminUserService.unsuspendUser(user.id).subscribe({
      next: () => {
        this.loadUsers();
      },
      error: (err: any) => {
        this.logger.error('Error unsuspending user', err);
        alert('Error unsuspending user');
      }
    });
  }

  closeDialog(): void {
    this.showConfirmDialog.set(false);
    this.selectedUser.set(null);
    this.confirmAction.set(null);
  }

  getStatusBadgeClass(status: string): string {
    const classes: { [key: string]: string } = {
      'active': 'badge-success',
      'suspended': 'badge-warning'
    };
    return classes[status] || 'badge-secondary';
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'active': 'Active',
      'suspended': 'Suspended'
    };
    return labels[status] || status;
  }
}
