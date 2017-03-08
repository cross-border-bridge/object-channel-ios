// Copyright © 2017 DWANGO Co., Ltd.

#import <CoreData/CoreData.h>
#import <UIKit/UIKit.h>

@interface AppDelegate : UIResponder <UIApplicationDelegate>
@property (strong, nonatomic) UIWindow* window;
@property (readonly, strong) NSPersistentContainer* persistentContainer;
- (void)saveContext;
@end
